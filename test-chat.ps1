$headers = @{"Content-Type" = "application/json"}
$body = '{"message":"สวัสดี"}'
$response = Invoke-WebRequest -Uri "http://localhost:3456/api/v2/agents/4ce072b5-b44b-4c85-81aa-29a5bd517de0/chat" -Method POST -Headers $headers -Body $body
Write-Host "Status:" $response.StatusCode
Write-Host "Response:" $response.Content
