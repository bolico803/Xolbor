<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $username = sanitize_input($input['username'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        json_response(['success' => false, 'error' => 'Tous les champs sont requis'], 400);
    }
    
    $db = getDBConnection();
    
    // Rechercher l'utilisateur
    $stmt = $db->prepare("SELECT id, username, email, password_hash, xubor_balance, active_skin_id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($user = $result->fetch_assoc()) {
        // Vérifier le mot de passe
        if (password_verify($password, $user['password_hash'])) {
            // Générer un token
            $token = generateToken($user['id'], $user['username']);
            
            // Mettre à jour la dernière connexion
            $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $updateStmt->bind_param("i", $user['id']);
            $updateStmt->execute();
            
            json_response([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'xuborBalance' => $user['xubor_balance'],
                    'activeSkin' => $user['active_skin_id']
                ]
            ]);
        } else {
            json_response(['success' => false, 'error' => 'Identifiants incorrects'], 401);
        }
    } else {
        json_response(['success' => false, 'error' => 'Identifiants incorrects'], 401);
    }
    
    $stmt->close();
    $db->close();
} else {
    json_response(['success' => false, 'error' => 'Méthode non autorisée'], 405);
}
?>