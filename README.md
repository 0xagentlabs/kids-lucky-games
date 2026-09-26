# 星愿乐园

适合小朋友的抽奖小游戏集合，包含幸运转盘与快乐对对碰。

## 功能

- Neon Postgres 持久化奖品、概率和每日抽奖记录
- 服务端按可配置概率抽奖
- 转盘抽奖与对对碰两种玩法
- 数据库唯一约束保证每位访客每天最多抽奖一次
- 唯一 `admin` 管理员登录并配置奖品及中奖概率
- 首次登录强制修改管理员密码
- 响应式布局、键盘操作及减少动画支持

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 验证

```bash
npm run typecheck
npm run lint
npm run build
```

## 环境变量

- `DATABASE_URL`：Neon Postgres 连接地址
- `AUTH_SECRET`：管理员会话签名密钥
- `ADMIN_INITIAL_PASSWORD`：首次初始化 `admin` 用户所使用的临时密码

部署后首次使用管理员入口时必须修改临时密码。
