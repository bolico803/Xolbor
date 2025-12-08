<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (empty($token)) {
        json_response(['success' => false, 'error' => 'Non authentifié'], 401);
    }
    
    $userData = verifyToken(str_replace('Bearer ', '', $token));
    if (!$userData) {
        json_response(['success' => false, 'error' => 'Token invalide'], 401);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $friend_username = sanitize_input($input['username'] ?? '');
    
    if (empty($friend_username)) {
        json_response(['success' => false, 'error' => 'Pseudo requis'], 400);
    }
    
    // Vérifier que ce n'est pas soi-même
    if ($friend_username === $userData['username']) {
        json_response(['success' => false, 'error' => 'Vous ne pouvez pas vous ajouter vous-même'], 400);
    }
    
    $db = getDBConnection();
    
    // Trouver l'ami
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $friend_username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if (!$friend = $result->fetch_assoc()) {
        json_response(['success' => false, 'error' => 'Utilisateur non trouvé'], 404);
    }
    
    // Vérifier si la demande existe déjà
    $stmt = $db->prepare("SELECT id FROM friends WHERE 
                         ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)) 
                         AND status = 'pending'");
    $stmt->bind_param("iiii", $userData['user_id'], $friend['id'], $friend['id'], $userData['user_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Demande déjà envoyée'], 400);
    }
    
    // Vérifier si déjà amis
    $stmt = $db->prepare("SELECT id FROM friends WHERE 
                         ((user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)) 
                         AND status = 'accepted'");
    $stmt->bind_param("iiii", $userData['user_id'], $friend['id'], $friend['id'], $userData['user_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Vous êtes déjà amis'], 400);
    }
    
    // Envoyer la demande d'ami
    $stmt = $db->prepare("INSERT INTO friends (user_id_1, user_id_2, status, action_user_id) VALUES (?, ?, 'pending', ?)");
    $stmt->bind_param("iii", $userData['user_id'], $friend['id'], $userData['user_id']);
    
    if ($stmt->execute()) {
        json_response([
            'success' => true,
            'message' => 'Demande d\'ami envoyée'
        ]);
    } else {
        json_response(['success' => false, 'error' => 'Erreur lors de l\'envoi'], 500);
    }
    
    $stmt->close();
    $db->close();
} else {
    json_response(['success' => false, 'error' => 'Méthode non autorisée'], 405);
}
?>