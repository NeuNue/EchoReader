const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname)));
// 专门用于音频文件的路由
app.use('/audio', express.static(path.join(__dirname, 'audio')));

// 启动服务器
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 