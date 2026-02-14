# JohnAI Predictions - Quick Start Script
# Run this script to set up and start the application

Write-Host "🚀 JohnAI Predictions - Quick Start" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if .env exists
Write-Host ""
Write-Host "🔐 Checking environment configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    Write-Host "Creating .env from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  Please edit .env file and add your Supabase credentials before continuing" -ForegroundColor Yellow
    Write-Host "Press any key to open .env file..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    notepad .env
    Write-Host ""
    Write-Host "After saving your credentials, press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} else {
    Write-Host "✓ .env file exists" -ForegroundColor Green
}

# Build and start containers
Write-Host ""
Write-Host "🏗️  Building and starting containers..." -ForegroundColor Yellow
docker-compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Containers started successfully" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "✅ JohnAI Predictions is running!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Local access: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "🔍 Health check: http://localhost:3000/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 View logs:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs -f" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🛑 Stop containers:" -ForegroundColor Yellow
    Write-Host "   docker-compose down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📖 For Cloudflare Tunnel setup, see DEPLOYMENT.md" -ForegroundColor Yellow
    Write-Host ""
    
    # Open browser
    Write-Host "Opening browser in 3 seconds..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3000"
} else {
    Write-Host "✗ Failed to start containers" -ForegroundColor Red
    Write-Host "Check the logs above for errors" -ForegroundColor Yellow
    exit 1
}
