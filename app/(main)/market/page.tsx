"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Rss,
  Search,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  Users,
  Star,
  Globe,
  Hash,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface MarketFeed {
  id: string;
  feedId: string;
  category: string;
  isFeatured: boolean;
  subscriberCount: number;
  isSubscribed?: boolean;
  feed: {
    id: string;
    url: string;
    title: string;
    description: string | null;
    icon: string | null;
    category: string;
  };
}

// RSSHub 热门路由
const RSSHUB_ROUTES = [
  {
    id: "rsshub-bilibili",
    title: "Bilibili 热门",
    description: "B站热门视频、排行榜",
    url: "https://rsshub.app/bilibili/hot/search",
    category: "视频",
    tags: ["bilibili", "视频", "热门"],
  },
  {
    id: "rsshub-weibo",
    title: "微博热搜",
    description: "微博实时热搜榜",
    url: "https://rsshub.app/weibo/search/hot",
    category: "社交",
    tags: ["微博", "热搜", "社交"],
  },
  {
    id: "rsshub-zhihu",
    title: "知乎热榜",
    description: "知乎每日热榜问题",
    url: "https://rsshub.app/zhihu/hot",
    category: "知识",
    tags: ["知乎", "热榜", "问答"],
  },
  {
    id: "rsshub-juejin",
    title: "掘金热门",
    description: "掘金社区热门文章",
    url: "https://rsshub.app/juejin/hot/articles",
    category: "技术",
    tags: ["掘金", "技术", "编程"],
  },
  {
    id: "rsshub-github",
    title: "GitHub Trending",
    description: "GitHub 每日热门仓库",
    url: "https://rsshub.app/github/trending/daily",
    category: "技术",
    tags: ["GitHub", "开源", "编程"],
  },
  {
    id: "rsshub-producthunt",
    title: "Product Hunt",
    description: "Product Hunt 每日热门产品",
    url: "https://rsshub.app/producthunt/today",
    category: "产品",
    tags: ["ProductHunt", "产品", "创新"],
  },
  {
    id: "rsshub-hackernews",
    title: "Hacker News",
    description: "Hacker News 热门文章",
    url: "https://rsshub.app/hackernews",
    category: "技术",
    tags: ["HackerNews", "技术", "创业"],
  },
  {
    id: "rsshub-reddit",
    title: "Reddit 热门",
    description: "Reddit 热门帖子",
    url: "https://rsshub.app/reddit/hot",
    category: "社交",
    tags: ["Reddit", "社区", "讨论"],
  },
];

const CATEGORIES = [
  "全部",
  "技术",
  "新闻",
  "博客",
  "视频",
  "科学",
  "商业",
  "设计",
  "生活",
];

export default function MarketPage() {
  const [feeds, setFeeds] = useState<MarketFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState("market");

  useEffect(() => {
    fetchMarketFeeds();
  }, []);

  const fetchMarketFeeds = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/market");
      const data = await response.json();

      if (data.success) {
        setFeeds(data.data || []);
      } else {
        toast.error(data.message || "获取 RSS 市场数据失败");
      }
    } catch (error) {
      console.error("Fetch market feeds error:", error);
      toast.error("获取 RSS 市场数据失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (feed: MarketFeed | { url: string; title: string }) => {
    try {
      const feedId = "url" in feed ? feed.url : feed.feedId;
      setSubscribingId(feedId);

      const response = await fetch("/api/feeds/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "url" in feed ? feed.url : feed.feed.url,
          isNotify: true,
        }),
      });

      // 响应可能不是 JSON（比如网关返回 HTML 错误页），先按文本读再解析，
      // 否则 response.json() 会抛 SyntaxError，用户看到的是「订阅失败」
      // 这种没法定位的提示。
      const text = await response.text();
      let data: { success?: boolean; message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        console.error("订阅接口返回了非 JSON 内容:", text.slice(0, 200));
        toast.error(`订阅失败（HTTP ${response.status}）`);
        setSubscribingId(null);
        return;
      }

      if (data.success) {
        // 已订阅过也走 success 分支，message 里会说清楚
        const subscribedTitle =
          "feed" in feed ? feed.feed?.title || "该源" : feed.title;
        toast.success(data.message || `成功订阅 ${subscribedTitle}`);
        // 刷新市场数据以更新订阅状态
        await fetchMarketFeeds();
      } else {
        toast.error(data.message || `订阅失败（HTTP ${response.status}）`);
      }
    } catch (error) {
      // 网络层失败（断网、跨域、请求被浏览器拦），必须让用户知道
      console.error("Subscribe error:", error);
      toast.error(error instanceof Error ? `订阅失败：${error.message}` : "订阅失败");
    } finally {
      setSubscribingId(null);
    }
  };

  const handleUnsubscribe = async (feed: MarketFeed) => {
    try {
      setSubscribingId(feed.feedId);

      const response = await fetch(`/api/feeds/subscriptions/${feed.feedId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`已取消订阅 ${feed.feed?.title || "该源"}`);
        // 刷新市场数据以更新订阅状态
        await fetchMarketFeeds();
      } else {
        toast.error(data.message || "取消订阅失败");
      }
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast.error("取消订阅失败");
    } finally {
      setSubscribingId(null);
    }
  };

  const handleCustomSubscribe = async () => {
    if (!customUrl.trim()) {
      toast.error("请输入 RSS 链接");
      return;
    }

    try {
      setIsValidating(true);

      // 先验证 RSS 链接
      const validateResponse = await fetch("/api/feeds/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: customUrl.trim() }),
      });

      const validateData = await validateResponse.json();

      if (!validateData.success) {
        toast.error(validateData.message || "无效的 RSS 链接");
        return;
      }

      // 订阅
      await handleSubscribe({
        url: customUrl.trim(),
        title: validateData.data?.title || "自定义源",
      });

      setCustomUrl("");
    } catch (error) {
      console.error("Custom subscribe error:", error);
      toast.error("订阅失败");
    } finally {
      setIsValidating(false);
    }
  };

  const filteredFeeds = feeds.filter((feed) => {
    const matchesSearch =
      (feed.feed?.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (feed.feed?.description?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "全部" || feed.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const featuredFeeds = filteredFeeds.filter((f) => f.isFeatured);
  const regularFeeds = filteredFeeds.filter((f) => !f.isFeatured);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Rss className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">WeRSS</span>
            </Link>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/reader">
              <Button variant="ghost" size="sm">
                阅读器
              </Button>
            </Link>
            <Link href="/subscriptions">
              <Button variant="ghost" size="sm">
                订阅管理
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm">
                个人中心
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">RSS 市场</h1>
          <p className="text-muted-foreground">
            发现优质 RSS 源，订阅您感兴趣的内容
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="market">
              <Globe className="h-4 w-4 mr-2" />
              RSS 市场
            </TabsTrigger>
            <TabsTrigger value="rsshub">
              <Sparkles className="h-4 w-4 mr-2" />
              RSSHub
            </TabsTrigger>
            <TabsTrigger value="custom">
              <LinkIcon className="h-4 w-4 mr-2" />
              自定义
            </TabsTrigger>
          </TabsList>

          {/* RSS Market Tab */}
          <TabsContent value="market" className="space-y-6">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索 RSS 源..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Featured Feeds */}
                {featuredFeeds.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      精选推荐
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {featuredFeeds.map((feed) => (
                        <FeedCard
                          key={feed.id}
                          feed={feed}
                          isSubscribing={subscribingId === feed.feedId}
                          onSubscribe={() => handleSubscribe(feed)}
                          onUnsubscribe={() => handleUnsubscribe(feed)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Regular Feeds */}
                {regularFeeds.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">全部源</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {regularFeeds.map((feed) => (
                        <FeedCard
                          key={feed.id}
                          feed={feed}
                          isSubscribing={subscribingId === feed.feedId}
                          onSubscribe={() => handleSubscribe(feed)}
                          onUnsubscribe={() => handleUnsubscribe(feed)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredFeeds.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>没有找到匹配的 RSS 源</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* RSSHub Tab */}
          <TabsContent value="rsshub" className="space-y-6">
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                RSSHub 热门频道
              </h2>
              <p className="text-muted-foreground text-sm">
                RSSHub 是一个开源的 RSS 生成器，可以从各种网站生成 RSS 订阅源。
                以下是一些热门频道，点击即可订阅。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RSSHUB_ROUTES.map((route) => (
                <div
                  key={route.id}
                  className="bg-card rounded-xl border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {route.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{route.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {route.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge variant="secondary">{route.category}</Badge>
                    {route.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    className="w-full mt-4"
                    onClick={() =>
                      handleSubscribe({
                        url: route.url,
                        title: route.title,
                      })
                    }
                    disabled={subscribingId === route.url}
                  >
                    {subscribingId === route.url ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    订阅
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Custom Tab */}
          <TabsContent value="custom" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-card rounded-xl border p-6">
                <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  添加自定义 RSS 源
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  输入 RSS 订阅链接，我们会自动验证并添加订阅。
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      RSS 链接
                    </label>
                    <Input
                      placeholder="https://example.com/feed.xml"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCustomSubscribe}
                    disabled={isValidating || !customUrl.trim()}
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        验证中...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        添加订阅
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-3">常见 RSS 链接格式</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• 博客: https://example.com/feed.xml</li>
                    <li>• WordPress: https://example.com/feed/</li>
                    <li>• GitHub Releases: https://github.com/user/repo/releases.atom</li>
                    <li>• YouTube: https://www.youtube.com/feeds/videos.xml?channel_id=...</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FeedCard({
  feed,
  isSubscribing,
  onSubscribe,
  onUnsubscribe,
}: {
  feed: MarketFeed;
  isSubscribing: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}) {
  const isSubscribed = feed.isSubscribed;

  return (
    <div className="bg-card rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <img
          src={feed.feed?.icon || `https://api.dicebear.com/7.x/initials/svg?seed=${feed.feed?.title || "RSS"}`}
          alt={feed.feed?.title || "RSS"}
          className="w-12 h-12 rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{feed.feed?.title || "未知源"}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {feed.feed?.description || "暂无描述"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge variant="secondary">{feed.category}</Badge>
        {isSubscribed && (
          <Badge variant="default" className="bg-green-500">
            已订阅
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {feed.subscriberCount} 订阅
        </span>
      </div>

      <Button
        className="w-full mt-4"
        onClick={isSubscribed ? onUnsubscribe : onSubscribe}
        disabled={isSubscribing}
        variant={isSubscribed ? "outline" : "default"}
      >
        {isSubscribing ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : isSubscribed ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        {isSubscribed ? "已订阅" : "订阅"}
      </Button>
    </div>
  );
}
