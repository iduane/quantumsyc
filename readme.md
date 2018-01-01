## 实时双向文件同步工具

QuantumSync 用于实现两台电脑之间文件夹的自动双向同步，支持 Windows, Mac, Linux 。

## 执行命令

远程目录

    quantumsync serve [ -f /folder/to/sync ]

本地目录
    
    quantumsync sync [ -f /folder/to/sync ] -c password

密码为 quantumsync serve 动态生成


## 安装

1. 安装 Wathcman

QuantumSync 基于 Facebook's Watchman 实现文件目录的监控功能。在运行 QuantumSyc 之前首先需要在两台同步的电脑上都安装 Watchman 。
安装方法见 https://facebook.github.io/watchman/docs/install.html

Linux 上需要编译安装，以下是 Ubuntu 16.04 编译命令。
```
sudo apt-get install libtool m4 automake autoconf pkg-config libssl-dev
git clone https://github.com/facebook/watchman.git
cd watchman
git checkout v4.9.0  # the latest stable release
./autogen.sh
./configure
make
sudo make install
```

2. 安装 Quantum Sync

```
npm i -g quantumsync
```
