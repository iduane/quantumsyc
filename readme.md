## 实时双向文件同步工具

QuantumSync 用于实现两台电脑之间文件夹的自动双向同步，支持 Windows, Mac, Linux 。

[![CircleCI](https://circleci.com/gh/iduane/quantumsyc.svg?style=svg)](https://circleci.com/gh/iduane/quantumsyc) [![NPM Version](https://img.shields.io/npm/v/quantumsync.svg)](https://www.npmjs.com/package/quantumsync) [![node](https://img.shields.io/node/v/quantumsync.svg)]() [![DUB](https://img.shields.io/dub/l/vibe-d.svg)]()

## 安装

1. 安装 Wathcman

    QuantumSync 基于 Facebook's Watchman 实现文件目录的监控功能。在运行 QuantumSync 之前首先需要在两台同步的电脑上都安装 Watchman 。
    
    安装方法见 https://facebook.github.io/watchman/docs/install.html 。
    
    Linux 上需要编译安装，以下是 Ubuntu 16.04 编译命令。
    
    ```
    sudo apt-get install libtool m4 automake autoconf pkg-config libssl-dev
    git clone https://github.com/facebook/watchman.git
    cd watchman
    git checkout v4.9.0  # the latest stable release
    ./autogen.sh
    ./configure --without-python --without-pcre
    make
    sudo make install
    ```

2. 安装 Quantum Sync
    
    ```
    npm i -g quantumsync
    ```

## 执行命令

远程目录

    quantumsync serve [ -f /folder/to/sync ] [-p port]

本地目录
    
    quantumsync sync [ -f /folder/to/sync ] -h remote.ip [-p remotePort] -c password

密码为 quantumsync serve 动态生成

## 配置文件

QuantumSync 默认读取监控目录下 .quantumsync/quantumsync.config.json 作为其可选的配置文件。


```
{
    "usePassword": true,
    "useSSL": false,
    "sslOptions": {
        "key": "/path/to/key.pem",
        "cert": "/path/to/cert.pem",
        "passphrase": ""
    },
    "ignores": ["node_modules", ".git"],
    "secret": ""
}
```

1. usePassword - 是否需要密码，默认需要。
2. useSSL - 是否使用加密传输，默认关闭。在公开网络使用时，建议开启。开启时，需要配置 sslOptions 。
3. sslOptions - 加密传输配置

  - key - 加密私钥文件路径
  - cert - 加密证书文件路径
  - passphrase - 如果加密使用了 passphrase 则填写。可选参数。

4. ignores - 忽略文件列表，语法同 gitignore 。

5. secret - 密码混淆随机字符串，建议修改。任意 > 0 长度字符串即可。

## 常见问题

1. Ubuntu 上文件打开数量限制 https://github.com/facebook/watchman/issues/163
