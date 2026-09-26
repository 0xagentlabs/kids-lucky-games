# 星愿乐园

适合小朋友的抽奖小游戏集合，包含幸运转盘与快乐对对碰。

## 功能

- 服务端按可配置概率抽奖
- 转盘抽奖与对对碰两种玩法
- 浏览器记录与 HttpOnly Cookie 双重每日次数限制
- 奖品名称、颜色与中奖概率配置
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

> 当前规则配置保存在服务进程内。生产部署请接入数据库，并为规则设置接口增加管理员认证。
