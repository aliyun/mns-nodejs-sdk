# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] 

### Added
- STS Token 自动刷新功能：支持通过 `refreshSTSToken` 回调自动刷新临时凭证
- 并发控制：多个请求同时触发刷新时，只会执行一次刷新操作
- 错误容忍：刷新失败时继续使用旧凭证，避免请求全部失败

### Changed
- 优化 STS Token 刷新机制的健壮性

## [1.1.0]

### Added
- 支持自定义端点 (`endpoint`) 配置
- 支持超时配置 (`readTimeout`, `connectTimeout`)
- ES5 兼容代码构建

### Changed
- 优化区域和超时配置验证逻辑
