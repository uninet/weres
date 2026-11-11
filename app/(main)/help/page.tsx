"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  BookOpen,
  Rss,
  Heart,
  Settings,
  MessageSquare,
  Mail,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const faqs = [
  {
    category: "getting-started",
    question: "如何开始使用 WeRSS？",
    answer:
      "首先注册一个账号，然后你可以通过 RSS市场 浏览并订阅感兴趣的RSS源，或者使用 订阅管理 添加自定义RSS链接。订阅后，在 阅读器 页面即可查看所有更新的文章。",
  },
  {
    category: "getting-started",
    question: "什么是RSS？",
    answer:
      "RSS（Really Simple Syndication）是一种内容聚合格式，允许用户订阅网站的更新内容。通过RSS阅读器，你可以在一个地方查看所有订阅网站的最新文章，无需逐个访问。",
  },
  {
    category: "subscription",
    question: "如何添加自定义RSS订阅？",
    answer:
      "进入 订阅管理 页面，点击 添加订阅 按钮，输入RSS源的URL地址即可。系统会自动验证链接的有效性，并获取RSS源的基本信息。",
  },
  {
    category: "subscription",
    question: "RSS市场和技术博客推荐有什么区别？",
    answer:
      "RSS市场提供精选的优质RSS源，按分类整理，方便发现新内容。技术博客推荐则是针对技术爱好者 curated 的优质技术博客列表。两者都可以一键订阅。",
  },
  {
    category: "subscription",
    question: "如何管理订阅分组？",
    answer:
      "在 订阅管理 页面，你可以创建新的分组，并将订阅拖动到相应分组中。分组可以帮助你更好地组织和管理大量订阅源。",
  },
  {
    category: "reading",
    question: "如何收藏文章？",
    answer:
      "在阅读文章时，点击右上角的 心形图标 即可收藏文章。收藏的文章可以在 收藏 页面查看和管理。",
  },
  {
    category: "reading",
    question: "如何查看阅读历史？",
    answer:
      "所有阅读过的文章都会自动记录在 历史 页面。你可以查看阅读时间，也可以删除特定的阅读记录。",
  },
  {
    category: "reading",
    question: "阅读器支持哪些自定义设置？",
    answer:
      "在阅读器页面，你可以调整字体大小、切换主题（浅色/深色）、设置行间距等。点击右上角的 设置图标 即可访问这些选项。",
  },
  {
    category: "account",
    question: "如何修改个人信息？",
    answer:
      "进入 个人中心 页面，点击 编辑资料 按钮可以修改昵称、头像、简介等信息。修改后点击保存即可。",
  },
  {
    category: "account",
    question: "如何修改密码？",
    answer:
      "在 个人中心 页面，选择 账号安全 选项卡，点击 修改密码 按钮。需要输入当前密码和新密码进行验证。",
  },
  {
    category: "account",
    question: "如何绑定手机号或邮箱？",
    answer:
      "在 个人中心 页面的 账号安全 选项卡中，你可以添加或修改绑定的手机号和邮箱。绑定后可用于密码找回和接收通知。",
  },
  {
    category: "troubleshooting",
    question: "RSS源无法更新怎么办？",
    answer:
      "首先检查RSS链接是否有效，可以尝试在浏览器中打开链接查看。如果链接有效但仍无法更新，可能是RSS源服务器问题，建议稍后再试。你也可以尝试删除后重新添加订阅。",
  },
  {
    category: "troubleshooting",
    question: "文章显示乱码或格式异常？",
    answer:
      "这可能是由于RSS源编码问题或原文格式不标准导致的。你可以点击 阅读原文 按钮跳转到原网站查看。如果问题持续存在，请向我们反馈。",
  },
  {
    category: "troubleshooting",
    question: "忘记密码怎么办？",
    answer:
      "在登录页面点击 忘记密码 链接，输入绑定的邮箱或手机号，我们会发送重置密码的链接或验证码。按照提示操作即可重置密码。",
  },
];

const quickLinks = [
  {
    icon: BookOpen,
    title: "使用指南",
    description: "了解WeRSS的基本功能和使用方法",
    href: "#guide",
  },
  {
    icon: Rss,
    title: "RSS订阅",
    description: "学习如何添加和管理RSS订阅",
    href: "#subscription",
  },
  {
    icon: Heart,
    title: "收藏与历史",
    description: "管理你的收藏文章和阅读历史",
    href: "#reading",
  },
  {
    icon: Settings,
    title: "账号设置",
    description: "修改个人信息和账号安全设置",
    href: "#account",
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [
    { id: "getting-started", name: "入门指南", icon: BookOpen },
    { id: "subscription", name: "订阅管理", icon: Rss },
    { id: "reading", name: "阅读功能", icon: Heart },
    { id: "account", name: "账号相关", icon: Settings },
    { id: "troubleshooting", name: "常见问题", icon: HelpCircle },
  ];

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch =
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === null || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              帮助中心
            </h1>
            <p className="text-gray-500 mb-6 max-w-2xl mx-auto">
              查找使用指南、常见问题解答，或联系我们获取帮助
            </p>
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="搜索问题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Card
              key={link.title}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                const element = document.querySelector(link.href);
                element?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <link.icon className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{link.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {link.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border p-4 sticky top-4">
              <h3 className="font-medium text-gray-900 mb-4">问题分类</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeCategory === null
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  全部问题
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeCategory === category.id
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <category.icon className="w-4 h-4" />
                    {category.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* FAQ List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border">
              {filteredFaqs.length === 0 ? (
                <div className="p-8 text-center">
                  <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    没有找到相关问题
                  </h3>
                  <p className="text-gray-500">
                    请尝试其他关键词搜索，或联系客服获取帮助
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="border-b last:border-b-0"
                    >
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50">
                        <span className="text-left font-medium text-gray-900">
                          {faq.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <p className="text-gray-600 leading-relaxed">
                          {faq.answer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>

            {/* Contact Section */}
            <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
              <h3 className="text-xl font-semibold mb-2">还有其他问题？</h3>
              <p className="text-blue-100 mb-4">
                如果以上解答没有解决你的问题，欢迎联系我们
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    // 这个项目是自托管工具，没有客服系统。
                    // 与其留一个点了没反应的按钮，不如直接告诉用户该去哪儿提问。
                    toast.info("自托管版本没有在线客服，请在项目仓库提交 Issue");
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  在线客服
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-white text-white hover:bg-white/10"
                  asChild
                >
                  <a href="mailto:support@werss.local?subject=WeRSS%20反馈">
                    <Mail className="w-4 h-4" />
                    发送邮件
                  </a>
                </Button>
              </div>
            </div>

            {/* Feedback Section */}
            <div className="mt-8 bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                意见反馈
              </h3>
              <p className="text-gray-500 mb-4">
                你的建议是我们改进的动力，欢迎提出宝贵意见
              </p>
              <div className="space-y-4">
                <Input
                  placeholder="请输入你的建议或反馈..."
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
                <Button
                  onClick={() => {
                    if (!feedback.trim()) {
                      toast.error("请先写点内容");
                      return;
                    }
                    // 没有后端收集接口时，最诚实的做法是把内容交给用户自己带走，
                    // 而不是假装提交成功然后丢掉。
                    const url = `mailto:support@werss.local?subject=WeRSS%20反馈&body=${encodeURIComponent(feedback)}`;
                    window.location.href = url;
                    toast.success("已打开邮件客户端，请发送即可");
                    setFeedback("");
                  }}
                >
                  提交反馈
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
