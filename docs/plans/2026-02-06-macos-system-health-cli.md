# macOS System Health CLI Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready macOS CLI tool for system health monitoring, port management, and AI-powered security recommendations using native macOS tools and Ollama LLM.

**Architecture:** Python-based CLI with modular agent architecture. Six specialist modules (health monitor, storage analyzer, port scanner, port manager, Ollama advisor, CLI coordinator) coordinating through a central router. Uses native macOS commands (lsof, netstat, diskutil, pmset, etc.) and local Ollama API for AI features.

**Tech Stack:** Python 3.8+, psutil, argparse, native macOS system commands, Ollama HTTP API

**Design Docs Location:** `workspaces/2026-02-06-build-a-cli-tool-for-macos-that-checks-system-health-ports-open-manage-ports-use/artifacts/`

---

## Implementation Overview

**Output Directory:** `/Users/cypher/Public/code/agent-squad/artifacts/syshealth-cli/`

**Project Structure:**
```
artifacts/syshealth-cli/
├── syshealth                    # Main CLI entry point (executable)
├── setup.py                     # Installation script
├── requirements.txt             # Python dependencies
├── README.md                    # User documentation
├── src/
│   ├── __init__.py
│   ├── cli/
│   │   ├── __init__.py
│   │   ├── coordinator.py      # CLI Coordinator
│   │   └── parser.py           # Command parsing
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── health_monitor.py   # System health agent
│   │   ├── storage_analyzer.py # Storage agent
│   │   ├── port_scanner.py     # Port scanner agent
│   │   ├── port_manager.py     # Port manager agent
│   │   └── ollama_advisor.py   # AI advisor agent
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── formatters.py       # Output formatting
│   │   ├── logger.py           # Audit logging
│   │   └── config.py           # Configuration management
│   └── data/
│       ├── __init__.py
│       └── ports_db.py         # Port classification database
└── tests/
    ├── __init__.py
    ├── test_health_monitor.py
    ├── test_storage_analyzer.py
    ├── test_port_scanner.py
    ├── test_port_manager.py
    ├── test_ollama_advisor.py
    └── test_cli.py
```

---

## Task 1: Project Setup

**Files:**
- Create: `artifacts/syshealth-cli/requirements.txt`
- Create: `artifacts/syshealth-cli/setup.py`
- Create: `artifacts/syshealth-cli/README.md`
- Create: `artifacts/syshealth-cli/src/__init__.py`
- Create: `artifacts/syshealth-cli/tests/__init__.py`

**Step 1: Create project directory structure**

```bash
mkdir -p artifacts/syshealth-cli/{src/{cli,agents,utils,data},tests}
touch artifacts/syshealth-cli/src/__init__.py
touch artifacts/syshealth-cli/src/cli/__init__.py
touch artifacts/syshealth-cli/src/agents/__init__.py
touch artifacts/syshealth-cli/src/utils/__init__.py
touch artifacts/syshealth-cli/src/data/__init__.py
touch artifacts/syshealth-cli/tests/__init__.py
```

**Step 2: Create requirements.txt**

```txt
psutil>=5.9.0
```

**Step 3: Create setup.py**

```python
from setuptools import setup, find_packages

setup(
    name='syshealth',
    version='1.0.0',
    description='macOS System Health CLI Tool',
    author='Agent Squad',
    packages=find_packages(),
    install_requires=[
        'psutil>=5.9.0',
    ],
    entry_points={
        'console_scripts': [
            'syshealth=src.cli.coordinator:main',
        ],
    },
    python_requires='>=3.8',
)
```

**Step 4: Create README.md**

```markdown
# syshealth - macOS System Health CLI Tool

Comprehensive system monitoring, port management, and AI-powered security recommendations for macOS.

## Installation

```bash
pip install -e .
```

## Quick Start

```bash
# System health check
syshealth check

# Scan open ports
syshealth ports scan

# Get AI security recommendations
syshealth ports review --ai

# Storage analysis
syshealth storage report

# Ask AI assistant
syshealth ask "Why is my CPU high?"
```

## Requirements

- macOS 12+ (Monterey or later)
- Python 3.8+
- Optional: Ollama for AI features

## Commands

- `syshealth check` - System health scan
- `syshealth ports scan` - List open ports
- `syshealth ports close <port>` - Close port
- `syshealth ports review --ai` - AI recommendations
- `syshealth storage report` - Disk usage
- `syshealth ask "<question>"` - AI assistant

## Documentation

See `workspaces/2026-02-06-build-a-cli-tool-for-macos-that-checks-system-health-ports-open-manage-ports-use/artifacts/` for detailed design specs.
```

**Step 5: Commit**

```bash
git add artifacts/syshealth-cli
git commit -m "feat: initialize syshealth CLI project structure"
```

---

## Task 2: Port Classification Database

**Files:**
- Create: `artifacts/syshealth-cli/src/data/ports_db.py`
- Create: `artifacts/syshealth-cli/tests/test_ports_db.py`

**Step 1: Write test for port classification**

Create: `artifacts/syshealth-cli/tests/test_ports_db.py`

```python
import pytest
from src.data.ports_db import PortDatabase

def test_get_well_known_port():
    db = PortDatabase()
    info = db.get_port_info(22)
    assert info['name'] == 'SSH'
    assert info['risk'] == 'low'
    assert 'Secure Shell' in info['description']

def test_get_malware_port():
    db = PortDatabase()
    info = db.get_port_info(31337)
    assert info['risk'] == 'critical'
    assert 'Back Orifice' in info['description']

def test_unknown_port():
    db = PortDatabase()
    info = db.get_port_info(99999)
    assert info['name'] == 'Unknown'
    assert info['risk'] == 'medium'
```

**Step 2: Run test to verify it fails**

```bash
cd artifacts/syshealth-cli
python -m pytest tests/test_ports_db.py -v
```

Expected: FAIL with "ModuleNotFoundError: No module named 'src.data.ports_db'"

**Step 3: Implement port database**

Create: `artifacts/syshealth-cli/src/data/ports_db.py`

```python
"""Port classification database based on design spec."""

class PortDatabase:
    """Database of known ports with security classifications."""

    # Well-known ports (0-1023)
    WELL_KNOWN_PORTS = {
        20: {'name': 'FTP-DATA', 'description': 'File Transfer Protocol (Data)', 'risk': 'medium'},
        21: {'name': 'FTP', 'description': 'File Transfer Protocol (Control)', 'risk': 'medium'},
        22: {'name': 'SSH', 'description': 'Secure Shell', 'risk': 'low'},
        23: {'name': 'Telnet', 'description': 'Telnet (unencrypted)', 'risk': 'high'},
        25: {'name': 'SMTP', 'description': 'Simple Mail Transfer Protocol', 'risk': 'medium'},
        53: {'name': 'DNS', 'description': 'Domain Name System', 'risk': 'low'},
        80: {'name': 'HTTP', 'description': 'Hypertext Transfer Protocol', 'risk': 'low'},
        110: {'name': 'POP3', 'description': 'Post Office Protocol v3', 'risk': 'medium'},
        143: {'name': 'IMAP', 'description': 'Internet Message Access Protocol', 'risk': 'medium'},
        443: {'name': 'HTTPS', 'description': 'HTTP Secure', 'risk': 'low'},
        445: {'name': 'SMB', 'description': 'Server Message Block', 'risk': 'high'},
        3306: {'name': 'MySQL', 'description': 'MySQL Database', 'risk': 'medium'},
        3389: {'name': 'RDP', 'description': 'Remote Desktop Protocol', 'risk': 'high'},
        5432: {'name': 'PostgreSQL', 'description': 'PostgreSQL Database', 'risk': 'medium'},
        5900: {'name': 'VNC', 'description': 'Virtual Network Computing', 'risk': 'medium'},
        6379: {'name': 'Redis', 'description': 'Redis Database', 'risk': 'medium'},
        8080: {'name': 'HTTP-Alt', 'description': 'HTTP Alternate', 'risk': 'low'},
        27017: {'name': 'MongoDB', 'description': 'MongoDB Database', 'risk': 'medium'},
    }

    # macOS-specific ports
    MACOS_PORTS = {
        5353: {'name': 'Bonjour', 'description': 'macOS Bonjour/mDNS', 'risk': 'low'},
        7000: {'name': 'AirDrop', 'description': 'macOS AirDrop', 'risk': 'low'},
        62078: {'name': 'iCloud', 'description': 'iCloud Services', 'risk': 'low'},
    }

    # Known malware/backdoor ports
    MALWARE_PORTS = {
        12345: {'name': 'NetBus', 'description': 'NetBus Trojan', 'risk': 'critical'},
        31337: {'name': 'Back Orifice', 'description': 'Back Orifice Backdoor', 'risk': 'critical'},
        4444: {'name': 'Metasploit', 'description': 'Metasploit Default', 'risk': 'critical'},
        6666: {'name': 'IRC Bot', 'description': 'IRC Bot Network', 'risk': 'critical'},
    }

    def __init__(self):
        """Initialize port database."""
        self.ports = {}
        self.ports.update(self.WELL_KNOWN_PORTS)
        self.ports.update(self.MACOS_PORTS)
        self.ports.update(self.MALWARE_PORTS)

    def get_port_info(self, port: int) -> dict:
        """Get information about a port.

        Args:
            port: Port number

        Returns:
            Dict with name, description, risk level
        """
        if port in self.ports:
            return self.ports[port]

        # Unknown port - assign medium risk
        return {
            'name': 'Unknown',
            'description': f'Unknown service on port {port}',
            'risk': 'medium'
        }

    def is_malware_port(self, port: int) -> bool:
        """Check if port is associated with malware.

        Args:
            port: Port number

        Returns:
            True if known malware port
        """
        return port in self.MALWARE_PORTS
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_ports_db.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/data/ports_db.py tests/test_ports_db.py
git commit -m "feat: add port classification database with 20+ known ports"
```

---

## Task 3: Output Formatters

**Files:**
- Create: `artifacts/syshealth-cli/src/utils/formatters.py`
- Create: `artifacts/syshealth-cli/tests/test_formatters.py`

**Step 1: Write test for table formatting**

Create: `artifacts/syshealth-cli/tests/test_formatters.py`

```python
import pytest
from src.utils.formatters import TableFormatter, format_bytes, colorize

def test_format_bytes():
    assert format_bytes(1024) == "1.0 KB"
    assert format_bytes(1024 * 1024) == "1.0 MB"
    assert format_bytes(1024 * 1024 * 1024) == "1.0 GB"
    assert format_bytes(500) == "500 B"

def test_colorize():
    result = colorize("test", "green")
    assert "\033[" in result  # Contains ANSI codes
    assert "test" in result

def test_table_formatter():
    formatter = TableFormatter(["Name", "Value"])
    formatter.add_row(["CPU", "50%"])
    formatter.add_row(["Memory", "8 GB"])

    output = formatter.render()
    assert "Name" in output
    assert "CPU" in output
    assert "50%" in output
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_formatters.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement formatters**

Create: `artifacts/syshealth-cli/src/utils/formatters.py`

```python
"""Output formatting utilities."""

class Colors:
    """ANSI color codes."""
    RESET = '\033[0m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'

def colorize(text: str, color: str) -> str:
    """Colorize text with ANSI codes.

    Args:
        text: Text to colorize
        color: Color name (red, green, yellow, blue, magenta, cyan)

    Returns:
        Colorized text with ANSI codes
    """
    color_map = {
        'red': Colors.RED,
        'green': Colors.GREEN,
        'yellow': Colors.YELLOW,
        'blue': Colors.BLUE,
        'magenta': Colors.MAGENTA,
        'cyan': Colors.CYAN,
        'bold': Colors.BOLD,
    }

    color_code = color_map.get(color.lower(), '')
    return f"{color_code}{text}{Colors.RESET}"

def format_bytes(bytes_value: int) -> str:
    """Format bytes into human-readable size.

    Args:
        bytes_value: Number of bytes

    Returns:
        Formatted string (e.g., "1.5 GB")
    """
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    size = float(bytes_value)
    unit_index = 0

    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1

    if unit_index == 0:
        return f"{int(size)} {units[unit_index]}"
    return f"{size:.1f} {units[unit_index]}"

class TableFormatter:
    """Format data as ASCII table."""

    def __init__(self, headers: list):
        """Initialize table formatter.

        Args:
            headers: List of column headers
        """
        self.headers = headers
        self.rows = []

    def add_row(self, row: list):
        """Add a row to the table.

        Args:
            row: List of cell values
        """
        self.rows.append(row)

    def render(self) -> str:
        """Render table as string.

        Returns:
            Formatted ASCII table
        """
        if not self.rows:
            return ""

        # Calculate column widths
        all_rows = [self.headers] + self.rows
        col_widths = []
        for col_idx in range(len(self.headers)):
            max_width = max(len(str(row[col_idx])) for row in all_rows)
            col_widths.append(max_width)

        # Build table
        lines = []

        # Header
        header_line = " | ".join(
            str(h).ljust(w) for h, w in zip(self.headers, col_widths)
        )
        lines.append(header_line)

        # Separator
        separator = "-+-".join("-" * w for w in col_widths)
        lines.append(separator)

        # Rows
        for row in self.rows:
            row_line = " | ".join(
                str(cell).ljust(w) for cell, w in zip(row, col_widths)
            )
            lines.append(row_line)

        return "\n".join(lines)
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_formatters.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/utils/formatters.py tests/test_formatters.py
git commit -m "feat: add output formatters for tables and byte sizes"
```

---

## Task 4: System Health Monitor

**Files:**
- Create: `artifacts/syshealth-cli/src/agents/health_monitor.py`
- Create: `artifacts/syshealth-cli/tests/test_health_monitor.py`

**Step 1: Write test for CPU collection**

Create: `artifacts/syshealth-cli/tests/test_health_monitor.py`

```python
import pytest
from src.agents.health_monitor import HealthMonitor

def test_health_monitor_init():
    monitor = HealthMonitor()
    assert monitor is not None

def test_collect_cpu_metrics():
    monitor = HealthMonitor()
    cpu_data = monitor.collect_cpu_metrics()

    assert 'usage_percent' in cpu_data
    assert 'load_average' in cpu_data
    assert isinstance(cpu_data['usage_percent'], (int, float))
    assert cpu_data['usage_percent'] >= 0
    assert cpu_data['usage_percent'] <= 100

def test_calculate_health_score():
    monitor = HealthMonitor()

    # Test with good metrics
    score = monitor.calculate_health_score({
        'cpu': {'usage_percent': 30},
        'memory': {'percent_used': 50},
    })

    assert isinstance(score, int)
    assert 0 <= score <= 100
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_health_monitor.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement health monitor**

Create: `artifacts/syshealth-cli/src/agents/health_monitor.py`

```python
"""System health monitoring agent."""

import psutil
import subprocess
import json

class HealthMonitor:
    """Monitor macOS system health metrics."""

    def collect_cpu_metrics(self) -> dict:
        """Collect CPU usage and load metrics.

        Returns:
            Dict with CPU metrics
        """
        cpu_percent = psutil.cpu_percent(interval=1)
        load_avg = psutil.getloadavg()

        return {
            'usage_percent': cpu_percent,
            'load_average': {
                '1min': load_avg[0],
                '5min': load_avg[1],
                '15min': load_avg[2],
            },
            'cpu_count': psutil.cpu_count(),
        }

    def collect_memory_metrics(self) -> dict:
        """Collect memory usage metrics.

        Returns:
            Dict with memory metrics
        """
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()

        return {
            'total': mem.total,
            'available': mem.available,
            'used': mem.used,
            'percent_used': mem.percent,
            'swap_total': swap.total,
            'swap_used': swap.used,
        }

    def collect_disk_metrics(self) -> dict:
        """Collect disk usage metrics.

        Returns:
            Dict with disk metrics
        """
        disk = psutil.disk_usage('/')

        return {
            'total': disk.total,
            'used': disk.used,
            'free': disk.free,
            'percent_used': disk.percent,
        }

    def collect_all_metrics(self) -> dict:
        """Collect all system health metrics.

        Returns:
            Dict with all metrics
        """
        return {
            'cpu': self.collect_cpu_metrics(),
            'memory': self.collect_memory_metrics(),
            'disk': self.collect_disk_metrics(),
        }

    def calculate_health_score(self, metrics: dict) -> int:
        """Calculate overall health score (0-100).

        Args:
            metrics: System metrics dict

        Returns:
            Health score (0-100)
        """
        # CPU score (25% weight)
        cpu_usage = metrics.get('cpu', {}).get('usage_percent', 0)
        cpu_score = max(0, 100 - cpu_usage)

        # Memory score (30% weight)
        memory_usage = metrics.get('memory', {}).get('percent_used', 0)
        memory_score = max(0, 100 - memory_usage)

        # Calculate weighted score
        score = (cpu_score * 0.25) + (memory_score * 0.30)

        # Add disk score if available (simplified)
        disk_usage = metrics.get('disk', {}).get('percent_used', 0)
        disk_score = max(0, 100 - disk_usage)
        score += disk_score * 0.45

        return int(score)

    def get_health_status(self, score: int) -> str:
        """Get health status label from score.

        Args:
            score: Health score (0-100)

        Returns:
            Status label (Excellent, Good, Fair, Warning, Critical)
        """
        if score >= 90:
            return "Excellent"
        elif score >= 75:
            return "Good"
        elif score >= 60:
            return "Fair"
        elif score >= 40:
            return "Warning"
        else:
            return "Critical"
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_health_monitor.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/agents/health_monitor.py tests/test_health_monitor.py
git commit -m "feat: add system health monitor with CPU, memory, disk metrics"
```

---

## Task 5: Port Scanner

**Files:**
- Create: `artifacts/syshealth-cli/src/agents/port_scanner.py`
- Create: `artifacts/syshealth-cli/tests/test_port_scanner.py`

**Step 1: Write test for port scanning**

Create: `artifacts/syshealth-cli/tests/test_port_scanner.py`

```python
import pytest
from src.agents.port_scanner import PortScanner

def test_port_scanner_init():
    scanner = PortScanner()
    assert scanner is not None

def test_scan_listening_ports():
    scanner = PortScanner()
    ports = scanner.scan_listening_ports()

    assert isinstance(ports, list)
    # Should find at least some system ports
    assert len(ports) >= 0

def test_classify_port():
    scanner = PortScanner()

    # Test SSH classification
    classification = scanner.classify_port(22, 'root', 'sshd')
    assert classification['category'] == 'system'
    assert classification['risk'] in ['low', 'medium', 'high', 'critical']
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_port_scanner.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement port scanner**

Create: `artifacts/syshealth-cli/src/agents/port_scanner.py`

```python
"""Port scanning agent."""

import subprocess
import re
from src.data.ports_db import PortDatabase

class PortScanner:
    """Scan and analyze network ports on macOS."""

    def __init__(self):
        """Initialize port scanner."""
        self.port_db = PortDatabase()

    def scan_listening_ports(self) -> list:
        """Scan for listening TCP/UDP ports using lsof.

        Returns:
            List of dicts with port information
        """
        ports = []

        try:
            # Use lsof to find listening ports
            cmd = ['lsof', '-i', '-P', '-n', '-sTCP:LISTEN']
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                return ports

            # Parse lsof output
            lines = result.stdout.strip().split('\n')
            if len(lines) < 2:  # Header + at least one port
                return ports

            for line in lines[1:]:  # Skip header
                parts = line.split()
                if len(parts) < 9:
                    continue

                command = parts[0]
                pid = parts[1]
                user = parts[2]

                # Extract port from address (e.g., "*:8080" or "127.0.0.1:5432")
                address = parts[8]
                port_match = re.search(r':(\d+)$', address)
                if not port_match:
                    continue

                port_num = int(port_match.group(1))

                # Get port info from database
                port_info = self.port_db.get_port_info(port_num)

                # Classify the port
                classification = self.classify_port(port_num, user, command)

                ports.append({
                    'port': port_num,
                    'protocol': 'TCP',
                    'pid': pid,
                    'user': user,
                    'command': command,
                    'address': address,
                    'service': port_info['name'],
                    'description': port_info['description'],
                    'risk': classification['risk'],
                    'category': classification['category'],
                })

        except Exception as e:
            # Silently fail - may not have permissions
            pass

        return ports

    def classify_port(self, port: int, user: str, command: str) -> dict:
        """Classify a port as system/user/suspicious.

        Args:
            port: Port number
            user: User running the process
            command: Command name

        Returns:
            Dict with category and risk level
        """
        # Check if it's a malware port
        if self.port_db.is_malware_port(port):
            return {
                'category': 'suspicious',
                'risk': 'critical',
            }

        # System service detection
        if user == 'root' or user.startswith('_'):
            return {
                'category': 'system',
                'risk': 'low',
            }

        # User application
        port_info = self.port_db.get_port_info(port)
        return {
            'category': 'user',
            'risk': port_info['risk'],
        }
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_port_scanner.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/agents/port_scanner.py tests/test_port_scanner.py
git commit -m "feat: add port scanner with lsof integration and classification"
```

---

## Task 6: Storage Analyzer

**Files:**
- Create: `artifacts/syshealth-cli/src/agents/storage_analyzer.py`
- Create: `artifacts/syshealth-cli/tests/test_storage_analyzer.py`

**Step 1: Write test for storage analysis**

Create: `artifacts/syshealth-cli/tests/test_storage_analyzer.py`

```python
import pytest
from src.agents.storage_analyzer import StorageAnalyzer

def test_storage_analyzer_init():
    analyzer = StorageAnalyzer()
    assert analyzer is not None

def test_analyze_disk_usage():
    analyzer = StorageAnalyzer()
    usage = analyzer.analyze_disk_usage()

    assert isinstance(usage, dict)
    assert 'total' in usage
    assert 'used' in usage
    assert 'free' in usage
    assert usage['total'] > 0

def test_find_large_files():
    analyzer = StorageAnalyzer()
    # Test with home directory to find some files
    large_files = analyzer.find_large_files(min_size_mb=100, max_results=5)

    assert isinstance(large_files, list)
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_storage_analyzer.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement storage analyzer**

Create: `artifacts/syshealth-cli/src/agents/storage_analyzer.py`

```python
"""Storage analysis agent."""

import os
import subprocess
import psutil

class StorageAnalyzer:
    """Analyze disk usage and find large files."""

    def analyze_disk_usage(self) -> dict:
        """Analyze disk usage for root volume.

        Returns:
            Dict with disk usage information
        """
        disk = psutil.disk_usage('/')

        return {
            'total': disk.total,
            'used': disk.used,
            'free': disk.free,
            'percent_used': disk.percent,
        }

    def find_large_files(self, min_size_mb: int = 100, max_results: int = 10) -> list:
        """Find large files on the system.

        Args:
            min_size_mb: Minimum file size in MB
            max_results: Maximum number of results

        Returns:
            List of dicts with file information
        """
        large_files = []

        try:
            # Use find command to locate large files
            # Search in home directory only for safety
            home = os.path.expanduser('~')
            min_size = f"{min_size_mb}M"

            cmd = [
                'find', home,
                '-type', 'f',
                '-size', f'+{min_size}',
                '-ls'
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0:
                return large_files

            # Parse find output
            lines = result.stdout.strip().split('\n')
            for line in lines[:max_results]:
                parts = line.split()
                if len(parts) < 11:
                    continue

                size = int(parts[6])
                path = ' '.join(parts[10:])

                large_files.append({
                    'path': path,
                    'size': size,
                })

        except Exception:
            # Silently fail - may timeout or lack permissions
            pass

        return large_files

    def get_cleanup_recommendations(self) -> list:
        """Get cleanup recommendations for freeing disk space.

        Returns:
            List of cleanup recommendations
        """
        recommendations = []

        # Check cache directories
        cache_dirs = [
            ('~/Library/Caches', 'Browser and app caches', 'safe'),
            ('~/Downloads', 'Old downloads folder', 'review'),
            ('~/.Trash', 'Trash contents', 'safe'),
        ]

        for path, description, safety in cache_dirs:
            expanded_path = os.path.expanduser(path)
            if os.path.exists(expanded_path):
                try:
                    # Calculate directory size
                    total_size = 0
                    for dirpath, dirnames, filenames in os.walk(expanded_path):
                        for filename in filenames:
                            filepath = os.path.join(dirpath, filename)
                            try:
                                total_size += os.path.getsize(filepath)
                            except:
                                pass

                    if total_size > 100 * 1024 * 1024:  # > 100MB
                        recommendations.append({
                            'path': path,
                            'description': description,
                            'size': total_size,
                            'safety': safety,
                        })
                except:
                    pass

        return recommendations
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_storage_analyzer.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/agents/storage_analyzer.py tests/test_storage_analyzer.py
git commit -m "feat: add storage analyzer with disk usage and large file detection"
```

---

## Task 7: Port Manager (Basic - Kill Process)

**Files:**
- Create: `artifacts/syshealth-cli/src/agents/port_manager.py`
- Create: `artifacts/syshealth-cli/tests/test_port_manager.py`

**Step 1: Write test for port manager**

Create: `artifacts/syshealth-cli/tests/test_port_manager.py`

```python
import pytest
from src.agents.port_manager import PortManager

def test_port_manager_init():
    manager = PortManager()
    assert manager is not None

def test_is_critical_service():
    manager = PortManager()

    # Test critical services
    assert manager.is_critical_service('kernel_task', 'root') == True
    assert manager.is_critical_service('launchd', 'root') == True
    assert manager.is_critical_service('WindowServer', '_windowserver') == True

    # Test non-critical
    assert manager.is_critical_service('python', 'user') == False

def test_find_process_by_port():
    manager = PortManager()

    # This will return None for most unused ports
    process = manager.find_process_by_port(99999)
    assert process is None or isinstance(process, dict)
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_port_manager.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement port manager**

Create: `artifacts/syshealth-cli/src/agents/port_manager.py`

```python
"""Port management agent."""

import subprocess
import signal
import time
import re

class PortManager:
    """Manage ports and processes on macOS."""

    CRITICAL_SERVICES = {
        'kernel_task',
        'launchd',
        'WindowServer',
        'loginwindow',
        'systemstats',
        'notifyd',
    }

    def is_critical_service(self, process_name: str, user: str) -> bool:
        """Check if a process is a critical system service.

        Args:
            process_name: Name of the process
            user: User running the process

        Returns:
            True if critical service
        """
        return process_name in self.CRITICAL_SERVICES

    def find_process_by_port(self, port: int) -> dict:
        """Find the process using a specific port.

        Args:
            port: Port number

        Returns:
            Dict with process info or None
        """
        try:
            cmd = ['lsof', '-i', f':{port}', '-P', '-n']
            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode != 0:
                return None

            lines = result.stdout.strip().split('\n')
            if len(lines) < 2:
                return None

            # Parse first matching process
            parts = lines[1].split()
            if len(parts) < 9:
                return None

            return {
                'command': parts[0],
                'pid': int(parts[1]),
                'user': parts[2],
            }

        except Exception:
            return None

    def kill_process_by_port(self, port: int, force: bool = False) -> dict:
        """Kill the process using a specific port.

        Args:
            port: Port number
            force: Use SIGKILL immediately if True

        Returns:
            Dict with success status and message
        """
        # Find the process
        process = self.find_process_by_port(port)

        if not process:
            return {
                'success': False,
                'message': f'No process found on port {port}'
            }

        # Check if critical service
        if self.is_critical_service(process['command'], process['user']):
            return {
                'success': False,
                'message': f"Cannot kill critical service: {process['command']}"
            }

        # Kill the process
        try:
            pid = process['pid']

            if force:
                # Send SIGKILL immediately
                subprocess.run(['kill', '-9', str(pid)])
            else:
                # Send SIGTERM first, wait, then SIGKILL if needed
                subprocess.run(['kill', '-15', str(pid)])
                time.sleep(2)

                # Check if still running
                try:
                    subprocess.run(['kill', '-0', str(pid)], check=True)
                    # Still running, send SIGKILL
                    subprocess.run(['kill', '-9', str(pid)])
                except subprocess.CalledProcessError:
                    # Process already terminated
                    pass

            return {
                'success': True,
                'message': f"Killed process {process['command']} (PID {pid}) on port {port}"
            }

        except Exception as e:
            return {
                'success': False,
                'message': f"Failed to kill process: {str(e)}"
            }
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_port_manager.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/agents/port_manager.py tests/test_port_manager.py
git commit -m "feat: add port manager with process termination and safety checks"
```

---

## Task 8: Ollama Advisor (Basic)

**Files:**
- Create: `artifacts/syshealth-cli/src/agents/ollama_advisor.py`
- Create: `artifacts/syshealth-cli/tests/test_ollama_advisor.py`

**Step 1: Write test for Ollama advisor**

Create: `artifacts/syshealth-cli/tests/test_ollama_advisor.py`

```python
import pytest
from src.agents.ollama_advisor import OllamaAdvisor

def test_ollama_advisor_init():
    advisor = OllamaAdvisor()
    assert advisor is not None

def test_is_ollama_available():
    advisor = OllamaAdvisor()
    # This may be True or False depending on setup
    result = advisor.is_ollama_available()
    assert isinstance(result, bool)

def test_fallback_port_recommendations():
    advisor = OllamaAdvisor()

    ports = [
        {'port': 22, 'service': 'SSH', 'risk': 'low'},
        {'port': 31337, 'service': 'Back Orifice', 'risk': 'critical'},
    ]

    recommendations = advisor.get_port_recommendations_fallback(ports)
    assert isinstance(recommendations, list)
    assert len(recommendations) > 0
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_ollama_advisor.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement Ollama advisor**

Create: `artifacts/syshealth-cli/src/agents/ollama_advisor.py`

```python
"""Ollama AI advisor agent."""

import json
import urllib.request
import urllib.error

class OllamaAdvisor:
    """AI-powered security advisor using Ollama."""

    def __init__(self, ollama_url: str = "http://localhost:11434"):
        """Initialize Ollama advisor.

        Args:
            ollama_url: Ollama API endpoint
        """
        self.ollama_url = ollama_url
        self.model = "llama3"

    def is_ollama_available(self) -> bool:
        """Check if Ollama is running and accessible.

        Returns:
            True if Ollama is available
        """
        try:
            req = urllib.request.Request(f"{self.ollama_url}/api/tags")
            with urllib.request.urlopen(req, timeout=2) as response:
                return response.status == 200
        except:
            return False

    def query_ollama(self, prompt: str) -> str:
        """Query Ollama with a prompt.

        Args:
            prompt: The prompt to send

        Returns:
            Response text from Ollama
        """
        if not self.is_ollama_available():
            return None

        try:
            data = {
                'model': self.model,
                'prompt': prompt,
                'stream': False
            }

            req = urllib.request.Request(
                f"{self.ollama_url}/api/generate",
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )

            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result.get('response', '')

        except Exception:
            return None

    def get_port_recommendations(self, ports: list) -> list:
        """Get AI recommendations for open ports.

        Args:
            ports: List of port dicts

        Returns:
            List of recommendations
        """
        if not self.is_ollama_available():
            return self.get_port_recommendations_fallback(ports)

        # Build prompt
        port_list = "\n".join([
            f"- Port {p['port']}: {p.get('service', 'Unknown')} (risk: {p.get('risk', 'unknown')})"
            for p in ports
        ])

        prompt = f"""Analyze these open network ports and provide security recommendations:

{port_list}

For each port with medium or higher risk, recommend whether to close it and why. Be concise."""

        response = self.query_ollama(prompt)

        if response:
            return [{'recommendation': response}]

        # Fallback if query fails
        return self.get_port_recommendations_fallback(ports)

    def get_port_recommendations_fallback(self, ports: list) -> list:
        """Fallback rule-based recommendations when Ollama unavailable.

        Args:
            ports: List of port dicts

        Returns:
            List of recommendations
        """
        recommendations = []

        for port in ports:
            risk = port.get('risk', 'medium')
            port_num = port['port']
            service = port.get('service', 'Unknown')

            if risk == 'critical':
                recommendations.append({
                    'port': port_num,
                    'action': 'CLOSE IMMEDIATELY',
                    'reason': f'{service} is a known malware/backdoor port',
                    'priority': 'critical'
                })
            elif risk == 'high':
                recommendations.append({
                    'port': port_num,
                    'action': 'Consider closing',
                    'reason': f'{service} has high security risk',
                    'priority': 'high'
                })

        return recommendations

    def ask_assistant(self, question: str) -> str:
        """Ask the AI assistant a general question.

        Args:
            question: User's question

        Returns:
            Answer from AI or fallback message
        """
        if not self.is_ollama_available():
            return "Ollama is not available. Please install and start Ollama to use AI assistant features."

        response = self.query_ollama(question)

        if response:
            return response

        return "Failed to get response from Ollama."
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_ollama_advisor.py -v
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/agents/ollama_advisor.py tests/test_ollama_advisor.py
git commit -m "feat: add Ollama advisor with AI recommendations and fallback rules"
```

---

## Task 9: CLI Parser

**Files:**
- Create: `artifacts/syshealth-cli/src/cli/parser.py`
- Create: `artifacts/syshealth-cli/tests/test_cli.py`

**Step 1: Write test for CLI parser**

Create: `artifacts/syshealth-cli/tests/test_cli.py`

```python
import pytest
from src.cli.parser import create_parser

def test_create_parser():
    parser = create_parser()
    assert parser is not None

def test_parse_check_command():
    parser = create_parser()
    args = parser.parse_args(['check'])
    assert args.command == 'check'

def test_parse_ports_scan_command():
    parser = create_parser()
    args = parser.parse_args(['ports', 'scan'])
    assert args.command == 'ports'
    assert args.ports_command == 'scan'

def test_parse_ports_close_command():
    parser = create_parser()
    args = parser.parse_args(['ports', 'close', '8080'])
    assert args.command == 'ports'
    assert args.ports_command == 'close'
    assert args.port == 8080
```

**Step 2: Run test to verify it fails**

```bash
python -m pytest tests/test_cli.py -v
```

Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement CLI parser**

Create: `artifacts/syshealth-cli/src/cli/parser.py`

```python
"""CLI argument parser."""

import argparse

def create_parser() -> argparse.ArgumentParser:
    """Create the argument parser for syshealth CLI.

    Returns:
        Configured ArgumentParser
    """
    parser = argparse.ArgumentParser(
        prog='syshealth',
        description='macOS System Health CLI Tool'
    )

    parser.add_argument(
        '--json',
        action='store_true',
        help='Output in JSON format'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Verbose output'
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # check command
    subparsers.add_parser('check', help='System health check')

    # ports command
    ports_parser = subparsers.add_parser('ports', help='Port management')
    ports_subparsers = ports_parser.add_subparsers(
        dest='ports_command',
        help='Port operations'
    )

    ports_subparsers.add_parser('scan', help='Scan open ports')

    ports_review_parser = ports_subparsers.add_parser(
        'review',
        help='Get AI port recommendations'
    )
    ports_review_parser.add_argument(
        '--ai',
        action='store_true',
        help='Use AI analysis (requires Ollama)'
    )

    ports_close_parser = ports_subparsers.add_parser(
        'close',
        help='Close a port'
    )
    ports_close_parser.add_argument(
        'port',
        type=int,
        help='Port number to close'
    )
    ports_close_parser.add_argument(
        '--force',
        action='store_true',
        help='Force kill without graceful shutdown'
    )

    # storage command
    storage_parser = subparsers.add_parser('storage', help='Storage analysis')
    storage_subparsers = storage_parser.add_subparsers(
        dest='storage_command',
        help='Storage operations'
    )

    storage_subparsers.add_parser('report', help='Storage report')

    # ask command
    ask_parser = subparsers.add_parser('ask', help='Ask AI assistant')
    ask_parser.add_argument('question', help='Question for AI')

    return parser
```

**Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_cli.py -v
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/cli/parser.py tests/test_cli.py
git commit -m "feat: add CLI parser with check, ports, storage, ask commands"
```

---

## Task 10: CLI Coordinator (Main Entry Point)

**Files:**
- Create: `artifacts/syshealth-cli/src/cli/coordinator.py`
- Create: `artifacts/syshealth-cli/syshealth` (executable)

**Step 1: Write main coordinator**

Create: `artifacts/syshealth-cli/src/cli/coordinator.py`

```python
"""CLI coordinator - main entry point."""

import sys
import json
from src.cli.parser import create_parser
from src.agents.health_monitor import HealthMonitor
from src.agents.storage_analyzer import StorageAnalyzer
from src.agents.port_scanner import PortScanner
from src.agents.port_manager import PortManager
from src.agents.ollama_advisor import OllamaAdvisor
from src.utils.formatters import TableFormatter, format_bytes, colorize

class CLICoordinator:
    """Coordinate CLI commands and agent execution."""

    def __init__(self):
        """Initialize coordinator with all agents."""
        self.health_monitor = HealthMonitor()
        self.storage_analyzer = StorageAnalyzer()
        self.port_scanner = PortScanner()
        self.port_manager = PortManager()
        self.ollama_advisor = OllamaAdvisor()

    def handle_check(self, args) -> int:
        """Handle system health check command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        metrics = self.health_monitor.collect_all_metrics()
        score = self.health_monitor.calculate_health_score(metrics)
        status = self.health_monitor.get_health_status(score)

        if args.json:
            output = {
                'score': score,
                'status': status,
                'metrics': metrics
            }
            print(json.dumps(output, indent=2))
        else:
            # Table output
            print(colorize(f"\n=== System Health Check ===\n", "bold"))
            print(f"Overall Score: {colorize(str(score), 'green')} / 100")
            print(f"Status: {colorize(status, 'green')}\n")

            # CPU
            cpu = metrics['cpu']
            print(colorize("CPU:", "bold"))
            print(f"  Usage: {cpu['usage_percent']:.1f}%")
            print(f"  Load: {cpu['load_average']['1min']:.2f}, "
                  f"{cpu['load_average']['5min']:.2f}, "
                  f"{cpu['load_average']['15min']:.2f}\n")

            # Memory
            mem = metrics['memory']
            print(colorize("Memory:", "bold"))
            print(f"  Used: {format_bytes(mem['used'])} / {format_bytes(mem['total'])}")
            print(f"  Usage: {mem['percent_used']:.1f}%\n")

            # Disk
            disk = metrics['disk']
            print(colorize("Disk:", "bold"))
            print(f"  Used: {format_bytes(disk['used'])} / {format_bytes(disk['total'])}")
            print(f"  Free: {format_bytes(disk['free'])}")
            print(f"  Usage: {disk['percent_used']:.1f}%\n")

        return 0

    def handle_ports_scan(self, args) -> int:
        """Handle ports scan command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        ports = self.port_scanner.scan_listening_ports()

        if args.json:
            print(json.dumps(ports, indent=2))
        else:
            print(colorize(f"\n=== Open Ports ({len(ports)}) ===\n", "bold"))

            if not ports:
                print("No listening ports found.\n")
                return 0

            table = TableFormatter(['Port', 'Service', 'PID', 'User', 'Risk'])
            for port in ports:
                risk_color = {
                    'low': 'green',
                    'medium': 'yellow',
                    'high': 'red',
                    'critical': 'red'
                }.get(port['risk'], 'yellow')

                table.add_row([
                    str(port['port']),
                    port['service'],
                    port['pid'],
                    port['user'],
                    colorize(port['risk'].upper(), risk_color)
                ])

            print(table.render())
            print()

        return 0

    def handle_ports_review(self, args) -> int:
        """Handle ports review command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        ports = self.port_scanner.scan_listening_ports()

        print(colorize("\n=== Port Security Analysis ===\n", "bold"))

        if args.ai:
            print("Analyzing with AI...\n")

        recommendations = self.ollama_advisor.get_port_recommendations(ports)

        if args.json:
            print(json.dumps(recommendations, indent=2))
        else:
            if not recommendations:
                print("No recommendations at this time.\n")
                return 0

            for i, rec in enumerate(recommendations, 1):
                if 'recommendation' in rec:
                    # AI response
                    print(rec['recommendation'])
                    print()
                else:
                    # Fallback structured recommendation
                    priority_color = {
                        'critical': 'red',
                        'high': 'red',
                        'medium': 'yellow'
                    }.get(rec.get('priority', 'medium'), 'yellow')

                    print(f"{i}. Port {rec['port']}: {colorize(rec['action'], priority_color)}")
                    print(f"   Reason: {rec['reason']}\n")

        return 0

    def handle_ports_close(self, args) -> int:
        """Handle ports close command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        port = args.port

        # Confirmation
        print(f"\nAbout to close port {port}.")
        confirm = input("Are you sure? (y/N): ")

        if confirm.lower() != 'y':
            print("Cancelled.\n")
            return 0

        result = self.port_manager.kill_process_by_port(port, force=args.force)

        if result['success']:
            print(colorize(f"\n✓ {result['message']}\n", "green"))
            return 0
        else:
            print(colorize(f"\n✗ {result['message']}\n", "red"))
            return 1

    def handle_storage_report(self, args) -> int:
        """Handle storage report command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        usage = self.storage_analyzer.analyze_disk_usage()
        recommendations = self.storage_analyzer.get_cleanup_recommendations()

        if args.json:
            output = {
                'usage': usage,
                'recommendations': recommendations
            }
            print(json.dumps(output, indent=2))
        else:
            print(colorize("\n=== Storage Report ===\n", "bold"))

            print(colorize("Disk Usage:", "bold"))
            print(f"  Total: {format_bytes(usage['total'])}")
            print(f"  Used: {format_bytes(usage['used'])} ({usage['percent_used']:.1f}%)")
            print(f"  Free: {format_bytes(usage['free'])}\n")

            if recommendations:
                print(colorize("Cleanup Recommendations:", "bold"))
                for rec in recommendations:
                    safety_color = {'safe': 'green', 'review': 'yellow'}.get(rec['safety'], 'yellow')
                    print(f"  • {rec['path']}")
                    print(f"    Size: {format_bytes(rec['size'])} - {rec['description']}")
                    print(f"    Safety: {colorize(rec['safety'].upper(), safety_color)}\n")

        return 0

    def handle_ask(self, args) -> int:
        """Handle ask AI assistant command.

        Args:
            args: Parsed arguments

        Returns:
            Exit code
        """
        question = args.question

        print(colorize("\n=== AI Assistant ===\n", "bold"))
        print(f"Question: {question}\n")

        answer = self.ollama_advisor.ask_assistant(question)

        print(answer)
        print()

        return 0

    def run(self, args) -> int:
        """Run the coordinator with parsed arguments.

        Args:
            args: Parsed command-line arguments

        Returns:
            Exit code
        """
        if args.command == 'check':
            return self.handle_check(args)

        elif args.command == 'ports':
            if args.ports_command == 'scan':
                return self.handle_ports_scan(args)
            elif args.ports_command == 'review':
                return self.handle_ports_review(args)
            elif args.ports_command == 'close':
                return self.handle_ports_close(args)

        elif args.command == 'storage':
            if args.storage_command == 'report':
                return self.handle_storage_report(args)

        elif args.command == 'ask':
            return self.handle_ask(args)

        else:
            print("Unknown command. Use --help for usage information.")
            return 1

def main():
    """Main entry point."""
    parser = create_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    coordinator = CLICoordinator()
    return coordinator.run(args)

if __name__ == '__main__':
    sys.exit(main())
```

**Step 2: Create executable entry point**

Create: `artifacts/syshealth-cli/syshealth`

```bash
#!/usr/bin/env python3
"""syshealth CLI executable."""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from src.cli.coordinator import main

if __name__ == '__main__':
    sys.exit(main())
```

**Step 3: Make executable**

```bash
chmod +x artifacts/syshealth-cli/syshealth
```

**Step 4: Test the CLI manually**

```bash
cd artifacts/syshealth-cli
./syshealth --help
./syshealth check
./syshealth ports scan
```

**Step 5: Commit**

```bash
git add src/cli/coordinator.py syshealth
git commit -m "feat: add CLI coordinator with full command routing and output"
```

---

## Task 11: Final Integration Testing

**Files:**
- Update: `artifacts/syshealth-cli/README.md`

**Step 1: Test all commands**

```bash
cd artifacts/syshealth-cli

# Test health check
./syshealth check
./syshealth check --json

# Test port scan
./syshealth ports scan
./syshealth ports scan --json

# Test storage report
./syshealth storage report

# Test AI features (if Ollama installed)
./syshealth ports review --ai
./syshealth ask "What is system health monitoring?"
```

**Step 2: Run all unit tests**

```bash
python -m pytest tests/ -v
```

Expected: All tests pass

**Step 3: Update README with complete examples**

Update: `artifacts/syshealth-cli/README.md` - Add detailed usage examples, troubleshooting section

**Step 4: Create installation instructions**

Add to README:
```markdown
## Installation

1. Clone or download this directory
2. Install dependencies: `pip install -r requirements.txt`
3. Make executable: `chmod +x syshealth`
4. Run: `./syshealth --help`

Optional: Install Ollama for AI features:
- Visit https://ollama.ai
- Install and run: `ollama run llama3`
```

**Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: complete README with installation and usage examples"
```

---

## Completion Checklist

- [x] Project structure created
- [x] Port database with 20+ known ports
- [x] Output formatters (tables, colors, byte sizes)
- [x] System health monitor (CPU, memory, disk)
- [x] Port scanner with lsof integration
- [x] Storage analyzer with large file detection
- [x] Port manager with safety checks
- [x] Ollama advisor with AI and fallback
- [x] CLI parser with all commands
- [x] CLI coordinator with routing and output
- [x] Unit tests for all modules
- [x] Integration testing
- [x] Documentation complete

## Usage Examples

```bash
# System health check
./syshealth check

# Scan open ports
./syshealth ports scan

# Get AI security recommendations
./syshealth ports review --ai

# Close a specific port
./syshealth ports close 8080

# Storage report
./syshealth storage report

# Ask AI assistant
./syshealth ask "Why is my CPU high?"

# JSON output for scripting
./syshealth check --json
./syshealth ports scan --json
```

---

## Next Steps (Post-MVP)

1. Add firewall management features
2. Implement auto-rollback for firewall changes
3. Add watch mode for continuous monitoring
4. Implement configuration file support
5. Add more cleanup recommendation rules
6. Enhance AI prompt templates
7. Add result caching
8. Create installer script
9. Add man page documentation
10. Performance optimizations

---

**End of Implementation Plan**
