# linux部署
## bash脚本（centos）
### 1. 更新系统软件包
sudo dnf update -y

### 2. 安装基础工具 (Git, Curl)
sudo dnf install git curl -y

### 3. 安装 Node.js 18 (LTS 版本)
### 使用 NodeSource 源，这是最推荐的安装方式
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

### 4. 验证安装
node -v  # 应输出 v18.x.x
npm -v

### 5. 进入项目目录
cd /var/www/photo-gallery

### 6. 安装项目依赖 (只安装生产环境依赖)
npm install --production

### 7. 全局安装 PM2 (进程管理工具)
sudo npm install -g pm2

### 8. 启动服务 (使用我们之前创建的 ecosystem.config.js)
pm2 start ecosystem.config.js

### 9. 设置开机自启
pm2 save
pm2 startup
### (执行 pm2 startup 后，终端会提示你运行一行命令，请复制并运行那行命令)

### 10. 开放 3000 端口
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent

### 11. 重载防火墙配置使其生效
sudo firewall-cmd --reload
