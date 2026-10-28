<?php
// Proxy público de la API de Cotiza Go.
// Los clientes llaman a  https://cotizago.com.mx/api-cotizaciones  y esta
// pasarela reenvía la petición a la función real (oculta) de Supabase.
// Así nadie ve la URL interna, pero el comportamiento es idéntico.

$TARGET = 'https://mhvbsyacicntniapishp.supabase.co/functions/v1/api-cotizaciones';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: authorization, content-type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') {
  header('Content-Type: application/json');
  http_response_code(405);
  echo json_encode(array('error' => 'Usa POST'));
  exit;
}

// Recupera el header Authorization (algunos servidores lo omiten al pasar a PHP)
function auth_header() {
  foreach (array('HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION') as $k) {
    if (!empty($_SERVER[$k])) return $_SERVER[$k];
  }
  if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $val) {
      if (strcasecmp($name, 'Authorization') === 0) return $val;
    }
  }
  return '';
}

$auth = auth_header();
$body = file_get_contents('php://input');

$headers = array('Content-Type: application/json');
if ($auth !== '') { $headers[] = 'Authorization: ' . $auth; }

$ch = curl_init($TARGET);
curl_setopt_array($ch, array(
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $body,
  CURLOPT_HTTPHEADER => $headers,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 30,
));
$resp = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

header('Content-Type: application/json');
if ($resp === false) {
  http_response_code(502);
  echo json_encode(array('error' => 'No se pudo contactar el servicio', 'detalle' => $err));
  exit;
}
http_response_code($code ? $code : 500);
echo $resp;
