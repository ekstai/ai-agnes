# 图层分离 · Layer Split

把图片分离成图层、把文档拆成元素的本地插件。文件全程留在本机浏览器，不上传。

## 目录内容

| 文件 | 作用 |
|---|---|
| `plugin.json` | 清单元数据，`uiHtml: index.html` 声明界面 |
| `index.html` | 单文件界面（内联 CSS/JS，含分层引擎 + ZIP 解析/打包） |
| `SKILL.md` | 技能说明，供 AI 判断何时使用 |
| `README.md` | 本说明 |

## 功能

- **图片分层**：颜色量化 / 透明度 / 边缘线条三种算法，输出多层透明 PNG。
- **文档拆解**：PPTX 每页文本 + 内嵌媒体、DOCX 全文 + 媒体、XLSX 工作表文本 + 媒体。
- **PDF 提取**：从 PDF 二进制扫描并导出内嵌 JPEG/PNG。
- **打包下载**：把所有分离结果打成 ZIP。

## 实现要点

- 无外部库：ZIP 用原生 `CompressionStream('deflate-raw')` / `DecompressionStream`，Canvas 做像素处理。
- 沙箱 iframe 内运行（opaque origin），不读写主应用数据、不发网络请求。
- 所有计算在浏览器主线程，超大文件可能卡顿。

## 版本

1.0.0 · 2026-11-25
