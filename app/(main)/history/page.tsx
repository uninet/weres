"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  History,
  Trash2,
  ExternalLink,
  Clock,
  Calendar,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
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

interface ReadHistory {
  id: string;
  articleId: string;
  readAt: string;
  article: Article;
}

export default function HistoryPage() {
  const router = useRouter();
  const [histories, setHistories] = useState<ReadHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // 加载阅读历史
  const loadHistories = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/history?${params}`);
      if (!response.ok) throw new Error("加载失败");

      const data = await response.json();
      setHistories(data.histories);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("加载阅读历史失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistories();
  }, [pagination.page]);

  // 删除单条历史
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/history?ids=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("删除失败");

      setHistories(histories.filter((h) => h.id !== id));
      toast.success("已删除阅读记录");
    } catch (error) {
      toast.error("删除失败");
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error("请选择要删除的记录");
      return;
    }

    try {
      const response = await fetch(`/api/history?ids=${selectedIds.join(",")}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("删除失败");

      setHistories(histories.filter((h) => !selectedIds.includes(h.id)));
      setSelectedIds([]);
      toast.success(`已删除 ${selectedIds.length} 条阅读记录`);
    } catch (error) {
      toast.error("删除失败");
    }
  };

  // 清空所有历史
  const handleClearAll = async () => {
    try {
      const response = await fetch("/api/history", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("清空失败");

      setHistories([]);
      setSelectedIds([]);
      toast.success("已清空所有阅读历史");
    } catch (error) {
      toast.error("清空失败");
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.length === histories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(histories.map((h) => h.id));
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
  const handleOpenArticle = (link: string) => {
    window.open(link, "_blank");
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 按日期分组
  const groupedHistories = histories.reduce((groups, history) => {
    const date = new Date(history.readAt).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(history);
    return groups;
  }, {} as Record<string, ReadHistory[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <History className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">阅读历史</h1>
                <p className="text-sm text-gray-500">
                  共 {pagination.total} 条阅读记录
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除 ({selectedIds.length})
                </Button>
              )}
              {histories.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 mr-1" />
                      清空
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清空阅读历史？</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将删除所有阅读历史记录，无法恢复。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        确认清空
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : histories.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              暂无阅读记录
            </h3>
            <p className="text-gray-500 mb-4">
              在阅读器中阅读文章后，它们会显示在这里
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
                  histories.length > 0 && selectedIds.length === histories.length
                }
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">
                全选 ({selectedIds.length}/{histories.length})
              </span>
            </div>

            {/* History List */}
            <div className="space-y-6">
              {Object.entries(groupedHistories).map(([date, dayHistories]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 sticky top-20 bg-gray-50 py-2">
                    {date}
                  </h3>
                  <div className="space-y-3">
                    {dayHistories.map((history) => (
                      <Card
                        key={history.id}
                        className="p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedIds.includes(history.id)}
                            onCheckedChange={() => handleSelect(history.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <h3
                                className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer line-clamp-2"
                                onClick={() =>
                                  handleOpenArticle(history.article.link)
                                }
                              >
                                {history.article.title}
                              </h3>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-blue-500"
                                  onClick={() =>
                                    handleOpenArticle(history.article.link)
                                  }
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                                  onClick={() => handleDelete(history.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                              {history.article.description || "暂无描述"}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {history.article.feed.title}
                              </span>
                              {history.article.author && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {history.article.author}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(history.article.pubDate)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                阅读于 {formatDate(history.readAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
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
      </div>
    </div>
  );
}
