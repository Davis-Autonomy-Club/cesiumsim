#!/bin/bash
# ArduPilot SITL Native macOS Installation (NO DOCKER, NO WSL2)
# Works natively on macOS using Homebrew

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "   ArduPilot SITL Native macOS Installation"
echo "   Running on: $(uname -a)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if running on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "❌ This script is for macOS only. Current OS: $(uname -s)"
    exit 1
fi

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found. Please install Homebrew first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

echo "✅ Homebrew found: $(brew --version | head -n1)"
echo ""

# Install dependencies via Homebrew
echo "📦 Step 1/6: Installing dependencies via Homebrew..."
brew install \
    python3 \
    git \
    wget \
    gawk \
    gcc \
    make \
    cmake \
    ccache \
    zip

# Check if we need Rosetta 2 (for x86 binaries on Apple Silicon)
if [[ "$(uname -m)" == "arm64" ]]; then
    echo ""
    echo "⚠️  Apple Silicon detected. Some dependencies may need x86 compatibility."
    echo "   If build fails, you may need: softwareupdate --install-rosetta"
fi

# Clone ArduPilot
echo ""
echo "📦 Step 2/6: Cloning ArduPilot repository..."
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
echo "📦 Step 3/6: Installing Python dependencies..."
python3 -m pip install --user --upgrade pip setuptools wheel
python3 -m pip install --user empy==3.3.4 pexpect future

# Install ArduPilot Python requirements
if [ -f "Tools/autotest/pip3_requirements.txt" ]; then
    echo "   Installing ArduPilot Python requirements..."
    python3 -m pip install --user -r Tools/autotest/pip3_requirements.txt
fi

# Install additional macOS-specific dependencies
echo ""
echo "📦 Step 4/6: Installing additional build tools..."
brew install autoconf automake libtool pkg-config

# Setup environment
echo ""
echo "📦 Step 5/6: Setting up build environment..."
# On macOS, we need to set some environment variables
export PATH="$HOME/.local/bin:$PATH"
export PYTHONPATH="$HOME/.local/lib/python3.*/site-packages:$PYTHONPATH"

# For Apple Silicon, we may need to set architecture
if [[ "$(uname -m)" == "arm64" ]]; then
    export ARCHFLAGS="-arch arm64"
fi

# Build ArduCopter
echo ""
echo "📦 Step 6/6: Building ArduCopter (this may take 10-20 minutes)..."
echo "   ⚠️  On Apple Silicon, if build fails, you may need to set:"
echo "      export ARCHFLAGS=\"-arch arm64\""
echo ""

./waf configure --board sitl
./waf copter

# Add custom location for Davis, CA
echo ""
echo "📝 Adding custom location (Davis, CA) to locations.txt..."
mkdir -p ~/ardupilot/Tools/autotest
if [ ! -f ~/ardupilot/Tools/autotest/locations.txt ]; then
    touch ~/ardupilot/Tools/autotest/locations.txt
fi
if ! grep -q "DAVIS=" ~/ardupilot/Tools/autotest/locations.txt 2>/dev/null; then
    echo "DAVIS=38.5422,-121.7520,30,0" >> ~/ardupilot/Tools/autotest/locations.txt
    echo "   ✅ Added DAVIS location"
else
    echo "   ℹ️  DAVIS location already exists"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "   ✅ ArduPilot SITL Native macOS Installation Complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 To start SITL, run:"
echo "   cd ~/ardupilot/ArduCopter"
echo "   sim_vehicle.py -v ArduCopter -f gazebo-iris --console --map \\"
echo "       -L DAVIS --speedup=1"
echo ""
echo "   ⚠️  Note: --speedup=1 is required on Apple Silicon to prevent crashes"
echo ""
echo "   Or with custom location:"
echo "   sim_vehicle.py -v ArduCopter -f gazebo-iris --console --map \\"
echo "       --custom-location=38.5422,-121.7520,30,0 --speedup=1"
echo ""
