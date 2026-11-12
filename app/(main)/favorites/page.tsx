"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Search,
  Trash2,
  ExternalLink,
  Clock,
  Calendar,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Article {
  id: string;
  title: string;
  description: string | null;
  link: string;
  author: string | null;
  pubDate: string;
  imageUrl: string | null;
  feed: {
    id: string;
    title: string;
    icon: string | null;
  };
}

interface Favorite {
  id: string;
  articleId: string;
  createdAt: string;
  article: Article;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // 加载收藏列表
  const loadFavorites = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/favorites?${params}`);
      if (!response.ok) throw new Error("加载失败");

      const data = await response.json();
      setFavorites(data.favorites);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("加载收藏列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [pagination.page, searchQuery]);

  // 取消收藏
  const handleUnfavorite = async (articleId: string) => {
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });

      if (!response.ok) throw new Error("操作失败");

      const data = await response.json();
      if (!data.isFavorited) {
        setFavorites(favorites.filter((f) => f.articleId !== articleId));
        toast.success("已取消收藏");
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error("请选择要删除的收藏");
      return;
    }

    try {
      const response = await fetch(`/api/favorites?ids=${selectedIds.join(",")}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("删除失败");

      setFavorites(favorites.filter((f) => !selectedIds.includes(f.id)));
      setSelectedIds([]);
      toast.success(`已删除 ${selectedIds.length} 个收藏`);
    } catch (error) {
      toast.error("删除失败");
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.length === favorites.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(favorites.map((f) => f.id));
    }
  };

  // 选择/取消选择
  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // 打开文章
  //
  // 原来是 window.open(article.link, "_blank")：点自己收藏的一篇，
  // 浏览器立刻跳去原始站点。用户收藏是为了「以后还在这里读」，
  // 不是为了存一个书签。现在跳站内阅读器深链，按 id 取全文。
  const handleOpenArticle = (articleId: string) => {
    router.push(`/reader?articleId=${articleId}`);
  };

  /** 打开原文：这是「跳出去」，和上面「在站内读」是两件事，图标也不同 */
  const handleOpenOriginal = (link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 排序收藏
  const sortedFavorites = [...favorites].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "title":
        return a.article.title.localeCompare(b.article.title);
      default:
        return 0;
    }
  });

  return (
    <PageShell
      title="我的收藏"
      subtitle={`共 ${pagination.total} 篇`}
      icon={Heart}
      iconClassName="bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400"
      actions={
        selectedIds.length > 0 ? (
          <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            删除 ({selectedIds.length})
          </Button>
        ) : null
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索收藏文章..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新收藏</SelectItem>
            <SelectItem value="oldest">最早收藏</SelectItem>
            <SelectItem value="title">标题排序</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              暂无收藏文章
            </h3>
            <p className="text-gray-500 mb-4">
              {searchQuery
                ? "没有找到匹配的收藏文章"
                : "在阅读器中收藏喜欢的文章，它们会显示在这里"}
            </p>
            <Button onClick={() => router.push("/reader")}>
              去阅读器
            </Button>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                checked={
                  favorites.length > 0 && selectedIds.length === favorites.length
                }
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">
                全选 ({selectedIds.length}/{favorites.length})
              </span>
            </div>

            {/* Favorites List */}
            <div className="space-y-4">
              {sortedFavorites.map((favorite) => (
                <Card
                  key={favorite.id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedIds.includes(favorite.id)}
                      onCheckedChange={() => handleSelect(favorite.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <h3
                          className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer line-clamp-2"
                          onClick={() => handleOpenArticle(favorite.article.id)}
                        >
                          {favorite.article.title}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-500"
                            title="打开原文"
                            onClick={() => handleOpenOriginal(favorite.article.link)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => handleUnfavorite(favorite.articleId)}
                          >
                            <Heart className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {favorite.article.description || "暂无描述"}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {favorite.article.feed.title}
                        </span>
                        {favorite.article.author && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {favorite.article.author}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(favorite.article.pubDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          收藏于 {formatDate(favorite.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  第 {pagination.page} / {pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  disabled={pagination.page === pagination.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
    </PageShell>
  );
}
