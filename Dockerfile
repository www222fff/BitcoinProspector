# 使用官方 Node.js LTS 版本
FROM node:lts

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装 npm 依赖
RUN npm install

# 复制所有项目文件到容器
COPY . .

# 运行 node index.js
CMD ["node", "index.js"]

