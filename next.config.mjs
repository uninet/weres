/** @type {import('next').NextConfig} */
const nextConfig = {
  // 产出 .next/standalone：一个自带精简 node_modules 的可直接运行目录。
  // Docker 镜像只拷贝它，无需在镜像里安装 node_modules（见 Dockerfile）。
  output: "standalone",

  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },

  images: {
    // 原来这里是 hostname: "**"，等于允许把任意外部域的图片交给
    // Next 的图片优化器去抓取 —— 任何人构造一个 ?url= 请求就能让服务器
    // 去访问内网地址（SSRF 面）并消耗带宽做图片转码。
    //
    // RSS 源的图标/封面来自各种第三方站点，无法穷举白名单，
    // 因此直接关掉服务端图片优化：浏览器自行加载，服务器不再代理。
    unoptimized: true,
  },

  // 安全响应头
  //
  // 这些头对 RSS 阅读器尤其重要：页面会渲染第三方 HTML，
  // 一旦净化器有遗漏，CSP 是最后一道防线。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 禁止浏览器用「嗅探内容」的方式改变 Content-Type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 不允许本站被任意站点 iframe 嵌套（防点击劫持）
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // 跨站跳转时不泄露完整 URL
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 不授予任何未使用的浏览器能力
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // renderer 进程越权提权的兜底
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
