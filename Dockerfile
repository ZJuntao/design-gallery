# 使用官方 Node.js 轻量级镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json (如果有)
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制所有源代码
COPY . .

# 创建必要的存储目录（如果项目中没有提交空目录）
RUN mkdir -p gallery

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
