#!/bin/bash
# ArduPilot SITL Native Installation Script (NO DOCKER)
# Works on: Linux, WSL2, Linux VM
# Run this in a Linux terminal (WSL2, VM, or native Linux)

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "   ArduPilot SITL Native Installation (No Docker)"
echo "   Running on: $(uname -a)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if running on Linux
if [[ "$(uname -s)" != "Linux" ]]; then
    echo "❌ ArduPilot SITL requires Linux."
    echo "   Current OS: $(uname -s)"
    echo ""
    echo "   Options:"
    echo "   1. Use WSL2 (Windows): wsl --install -d Ubuntu"
    echo "   2. Use Linux VM (macOS): VMware Fusion, Parallels, or VirtualBox"
    echo "   3. Use a remote Linux machine via SSH"
    echo ""
    exit 1
fi

# Update system
echo "📦 Step 1/7: Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
echo ""
echo "📦 Step 2/7: Installing build dependencies..."
sudo apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    ccache \
    g++ \
    gawk \
    wget \
    libxml2-dev \
    libxslt1-dev \
    python3-lxml \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    libtool-bin \
    zip \
    default-jre

# Clone ArduPilot
echo ""
echo "📦 Step 3/7: Cloning ArduPilot repository..."
if [ -d "$HOME/ardupilot" ]; then
    echo "   ⚠️  ArduPilot directory exists. Updating..."
    cd ~/ardupilot
    git pull
    git submodule update --init --recursive
else
    cd ~
    git clone https://github.com/ArduPilot/ardupilot.git --recurse-submodules
    cd ardupilot
fi

# Install Python dependencies
echo ""
echo "📦 Step 4/7: Installing Python dependencies..."
pip3 install --user empy==3.3.4 pexpect future

# Setup environment
echo ""
echo "📦 Step 5/7: Setting up build environment..."
./Tools/environment_install/install-prereqs-ubuntu.sh -y

# Reload profile
echo ""
echo "📦 Step 6/7: Reloading environment..."
. ~/.profile

# Build ArduCopter
echo ""
echo "📦 Step 7/7: Building ArduCopter (this may take 10-20 minutes)..."
./waf configure --board sitl
./waf copter

# Add custom location for Davis, CA
echo ""
echo "📝 Adding custom location (Davis, CA) to locations.txt..."
mkdir -p ~/ardupilot/Tools/autotest
if ! grep -q "DAVIS=" ~/ardupilot/Tools/autotest/locations.txt 2>/dev/null; then
    echo "DAVIS=38.5422,-121.7520,30,0" >> ~/ardupilot/Tools/autotest/locations.txt
    echo "   ✅ Added DAVIS location"
else
    echo "   ℹ️  DAVIS location already exists"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "   ✅ ArduPilot SITL Installation Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 To start SITL, run:"
echo "   cd ~/ardupilot/ArduCopter"
echo "   sim_vehicle.py -v ArduCopter -f gazebo-iris --console --map \\"
echo "       -L DAVIS"
echo ""
echo "   Or with custom location:"
echo "   sim_vehicle.py -v ArduCopter -f gazebo-iris --console --map \\"
echo "       --custom-location=38.5422,-121.7520,30,0"
echo ""
