<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $username = sanitize_input($input['username'] ?? '');
    $email = sanitize_input($input['email'] ?? '');
    $password = $input['password'] ?? '';
    
    // Validation
    if (empty($username) || empty($email) || empty($password)) {
        json_response(['success' => false, 'error' => 'Tous les champs sont requis'], 400);
    }
    
    if (strlen($username) < 3 || strlen($username) > 20) {
        json_response(['success' => false, 'error' => 'Le pseudo doit contenir entre 3 et 20 caractères'], 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['success' => false, 'error' => 'Email invalide'], 400);
    }
    
    if (strlen($password) < 8) {
        json_response(['success' => false, 'error' => 'Le mot de passe doit contenir au moins 8 caractères'], 400);
    }
    
    $db = getDBConnection();
    
    // Vérifier si le pseudo existe déjà
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Ce pseudo est déjà utilisé'], 400);
    }
    
    // Vérifier si l'email existe déjà
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Cet email est déjà utilisé'], 400);
    }
    
    // Hasher le mot de passe
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Créer l'utilisateur
    $stmt = $db->prepare("INSERT INTO users (username, email, password_hash, xubor_balance) VALUES (?, ?, ?, 100)");
    $stmt->bind_param("sss", $username, $email, $password_hash);
    
    if ($stmt->execute()) {
        $user_id = $stmt->insert_id;
        $token = generateToken($user_id, $username);
        
        json_response([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'email' => $email,
                'xuborBalance' => 100,
                'activeSkin' => null
            ]
        ]);
    } else {
        json_response(['success' => false, 'error' => 'Erreur lors de la création du compte'], 500);
    }
    
    $stmt->close();
    $db->close();
} else {
    json_response(['success' => false, 'error' => 'Méthode non autorisée'], 405);
}
?>