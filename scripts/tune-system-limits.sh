#!/bin/bash
# ==============================================================================
# Linux OS Tuning Script for 50000+ Concurrent WebSockets / TCP Sockets
# Run once on your Google Cloud VM: sudo bash scripts/tune-system-limits.sh
# ==============================================================================

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/tune-system-limits.sh"
  exit 1
fi

echo "Applying High-Concurrency Linux Kernel Settings for 50000+ connections..."

# 1. Increase File Descriptors in limits.conf
cat << 'EOF' > /etc/security/limits.d/99-shortmarket.conf
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

# 2. Kernel TCP & Socket Buffer Tuning
cat << 'EOF' > /etc/sysctl.d/99-shortmarket.conf
# Maximum open files
fs.file-max = 2097152

# Maximum incoming TCP connection backlog
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Fast TCP reuse & dynamic ephemeral port range
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# Keepalive timeouts for dead sockets
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# Memory socket buffers
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
EOF

sysctl -p /etc/sysctl.d/99-shortmarket.conf

echo "OS limits tuned successfully. Your VM is now ready for 50000+ simultaneous connections."