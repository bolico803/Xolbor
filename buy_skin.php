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
    $skin_id = intval($input['skin_id'] ?? 0);
    
    if ($skin_id <= 0) {
        json_response(['success' => false, 'error' => 'Skin invalide'], 400);
    }
    
    $db = getDBConnection();
    
    // Récupérer les informations du skin
    $stmt = $db->prepare("SELECT id, name, price_xubor FROM skins WHERE id = ?");
    $stmt->bind_param("i", $skin_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if (!$skin = $result->fetch_assoc()) {
        json_response(['success' => false, 'error' => 'Skin non trouvé'], 404);
    }
    
    // Vérifier si l'utilisateur possède déjà le skin
    $stmt = $db->prepare("SELECT user_id FROM user_skins WHERE user_id = ? AND skin_id = ?");
    $stmt->bind_param("ii", $userData['user_id'], $skin_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Vous possédez déjà ce skin'], 400);
    }
    
    // Vérifier le solde Xubor
    $stmt = $db->prepare("SELECT xubor_balance FROM users WHERE id = ?");
    $stmt->bind_param("i", $userData['user_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if ($user['xubor_balance'] < $skin['price_xubor']) {
        json_response(['success' => false, 'error' => 'Solde Xubor insuffisant'], 400);
    }
    
    // Démarrer la transaction
    $db->begin_transaction();
    
    try {
        // Déduire les Xubor
        $new_balance = $user['xubor_balance'] - $skin['price_xubor'];
        $stmt = $db->prepare("UPDATE users SET xubor_balance = ? WHERE id = ?");
        $stmt->bind_param("ii", $new_balance, $userData['user_id']);
        $stmt->execute();
        
        // Ajouter le skin à l'utilisateur
        $stmt = $db->prepare("INSERT INTO user_skins (user_id, skin_id) VALUES (?, ?)");
        $stmt->bind_param("ii", $userData['user_id'], $skin_id);
        $stmt->execute();
        
        // Enregistrer la transaction
        $stmt = $db->prepare("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'skin_purchase', ?, ?)");
        $description = "Achat du skin: " . $skin['name'];
        $stmt->bind_param("iis", $userData['user_id'], $skin['price_xubor'], $description);
        $stmt->execute();
        
        $db->commit();
        
        json_response([
            'success' => true,
            'newBalance' => $new_balance,
            'skin' => [
                'id' => $skin['id'],
                'name' => $skin['name']
            ]
        ]);
        
    } catch (Exception $e) {
        $db->rollback();
        json_response(['success' => false, 'error' => 'Erreur lors de l\'achat'], 500);
    }
    
    $stmt->close();
    $db->close();
} else {
    json_response(['success' => false, 'error' => 'Méthode non autorisée'], 405);
}
?>