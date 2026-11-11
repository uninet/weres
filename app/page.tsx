import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rss, BookOpen, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">WeRSS</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>注册</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            高效阅读，<span className="text-primary">一站聚合</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            WeRSS 是一款简洁优雅的RSS阅读工具，帮你聚合分散的信息源，
            让阅读回归本质。
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                开始使用
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/market">
              <Button size="lg" variant="outline">
                浏览RSS市场
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-card p-6 rounded-xl border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Rss className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">自定义订阅</h3>
            <p className="text-muted-foreground">
              支持任意RSS源订阅，自动抓取更新，让信息获取更高效
            </p>
          </div>
          <div className="bg-card p-6 rounded-xl border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">沉浸式阅读</h3>
            <p className="text-muted-foreground">
              三栏布局设计，支持多种阅读主题，打造舒适的阅读体验
            </p>
          </div>
          <div className="bg-card p-6 rounded-xl border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">RSS市场</h3>
            <p className="text-muted-foreground">
              精选优质RSS源，涵盖科技、资讯、GitHub、微信公众号等
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-20 py-8">
        <div className="container text-center text-muted-foreground">
          <p>© 2024 WeRSS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
