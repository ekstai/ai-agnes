---
name: 图层分离
description: 当用户提到分离图层、图片分层、把 PPT/Word/Excel 拆开、提取文档里的图片、PDF 图片提取、抠图分层时使用本技能。
---

# 图层分离（Layer Split）

一个纯前端插件：把图片分离成多个图层，把文档拆解成独立元素，全部在本机浏览器内完成，**文件不上传任何服务器**。

## 三种模式

1. **图片分层**：上传 PNG/JPG/WebP/GIF/BMP，选分层数与算法（颜色量化 / 透明度分层 / 边缘线条），得到多个透明 PNG 图层，可单独下载或打包 ZIP。
   - 颜色量化：k-means 采样把像素归入 N 个主色，每层保留该色像素（适合扁平图/插画/Logo）。
   - 透明度分层：按 alpha 区间拆层（适合带透明度的 PNG）。
   - 边缘线条：Sobel 提取边缘，分离出线条层与平坦区域层。
2. **文档拆解**：上传 PPTX/DOCX/XLSX（本质是 ZIP+XML），提取 `ppt|word|xl/media/*` 内嵌图片，以及每页幻灯片 / 文档 / 工作表的文本，逐项导出。
3. **PDF 提取**：扫描 PDF 二进制，提取内嵌的 JPEG/PNG 图片流。

## 使用方式

1. 在「插件 → 认证 / 我的」找到「图层分离」，打开详情页 → 点「打开界面」。
2. 选模式 → 拖入或选择文件 → 点对应按钮（开始分离 / 开始拆解 / 开始提取）。
3. 结果区可逐层下载，或点「打包下载 ZIP」一次拿全部。

## 技术说明

- 单文件 `index.html`，内联全部 CSS/JS，无外部依赖。
- ZIP 解压/打包用浏览器原生 `CompressionStream`/`DecompressionStream`（deflate-raw），不需 JSZip。
- 插件界面跑在 opaque-origin 沙箱 iframe（allow-scripts allow-forms），不访问宿主存储、不发起网络请求。
- 大文件（>100MB）可能受浏览器内存限制。
