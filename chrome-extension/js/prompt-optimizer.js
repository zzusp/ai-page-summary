// 智能提示词优化系统
class PromptOptimizer {
  constructor() {
    this.promptTemplates = this.initializeTemplates();
    this.optimizationRules = this.initializeRules();
  }

  // 初始化提示词模板
  initializeTemplates() {
    return {
      // 新闻文章类型
      news: {
        system: `你是一个专业的新闻内容总结专家。你的任务是对新闻文章进行客观、准确的总结。

总结原则：
1. 保持新闻的客观性和准确性
2. 提取5W1H要素：Who(谁)、What(什么)、When(何时)、Where(何地)、Why(为什么)、How(如何)
3. 突出关键事实和数据
4. 避免加入个人意见或评论
5. 使用新闻报道的正式语言风格
6. 保持时间顺序的逻辑性

输出格式：
- 使用清晰的段落结构
- 重点信息用项目符号列出
- 包含相关的重要引言或声明`,
        
        user: `请总结以下新闻内容：

标题：{title}

内容：
{content}

请提供简洁明了的新闻总结，重点突出关键事实。`
      },

      // 技术文档类型
      technical: {
        system: `你是一个技术文档分析专家。你的任务是对技术文档进行结构化的总结。

总结要求：
1. 保持技术术语的准确性
2. 提取核心概念和主要功能
3. 突出重要的步骤、配置或使用方法
4. 整理关键的技术要点
5. 保持逻辑清晰的技术文档结构
6. 避免添加主观评价或建议

输出格式：
- 按逻辑顺序组织内容
- 重要信息用编号或项目符号
- 包含必要的技术细节
- 简化复杂概念但保持准确性`,
        
        user: `请总结以下技术文档：

标题：{title}

内容：
{content}

请提供结构化的技术总结，突出关键信息。`
      },

      // 学术论文类型
      academic: {
        system: `你是一个学术论文分析专家。你的任务是对学术论文进行专业的总结。

总结要求：
1. 保持学术研究的严谨性
2. 提取研究目的、方法、结果和结论
3. 突出创新的理论和发现
4. 保持客观中性的学术态度
5. 使用准确的学术术语
6. 遵循学术写作的规范

输出格式：
- 包含研究背景和问题
- 简述研究方法
- 总结主要发现和结果
- 提取关键结论和意义`,
        
        user: `请总结以下学术论文：

标题：{title}

内容：
{content}

请提供学术性的客观总结，突出研究要点。`
      },

      // 产品页面类型
      product: {
        system: `你是一个产品信息总结专家。你的任务是对产品页面进行信息性的总结。

总结要求：
1. 客观描述产品特性和功能
2. 提取产品的主要卖点和优势
3. 包含重要的规格参数
4. 保持中性，避免营销性语言
5. 突出用户关心的关键信息
6. 整理产品使用的适用场景

输出格式：
- 产品概述
- 主要特性和功能
- 重要规格参数
- 适用场景或用途`,
        
        user: `请总结以下产品信息：

标题：{title}

内容：
{content}

请提供客观的产品信息总结，突出关键特性。`
      },

      // 博客文章类型
      blog: {
        system: `你是一个博客内容分析专家。你的任务是对博客文章进行平衡的总结。

总结要求：
1. 保持内容的完整性和连贯性
2. 提取作者的主要观点和论述
3. 保留重要的例子和说明
4. 避免加入个人判断或批评
5. 保持文章原有的语调风格
6. 整理逻辑清晰的要点

输出格式：
- 主题概述
- 主要观点
- 重要论据或例子
- 结论或总结`,
        
        user: `请总结以下博客内容：

标题：{title}

内容：
{content}

请提供平衡客观的总结，保留主要内容。`
      },

      // 论坛讨论类型
      forum: {
        system: `你是一个论坛讨论总结专家。你的任务是对论坛讨论进行信息性的总结。

总结要求：
1. 提取讨论的核心问题和争议点
2. 整理不同的观点和意见
3. 突出重要的信息和建议
4. 保持讨论的原始语境
5. 避免偏向任何特定观点
6. 整理关键的技术解决方案

输出格式：
- 讨论主题
- 主要观点汇总
- 重要信息或建议
- 解决方案总结`,
        
        user: `请总结以下论坛讨论：

标题：{title}

内容：
{content}

请提供信息性的讨论总结，突出关键观点。`
      },

      // 通用内容类型
      general: {
        system: `你是一个专业的内容总结专家。你的任务是对网页内容进行客观、准确的总结。

总结要求：
1. 以客观总结为主，避免主观评论
2. 保持内容的完整性和准确性
3. 提取关键信息和重要观点
4. 使用清晰、简洁的语言
5. 如果内容包含多个部分，请分别总结
6. 避免重复和冗余信息
7. 保留重要的数据、事实和结论

总结格式：
- 使用简洁的段落和项目符号
- 重点突出主要观点和关键信息
- 保持逻辑清晰和结构化`,
        
        user: `请总结以下网页内容：

标题：{title}

内容：
{content}

请提供详细的总结，突出重点内容。`
      }
    };
  }

  // 初始化优化规则
  initializeRules() {
    return {
      // 语言质量优化
      language: {
        minLength: 50,  // 最小总结长度
        maxLength: 2000, // 最大总结长度
        avoidWords: ['我认为', '我觉得', '显然', '很明显', '最好', '应该', '必须'],
        requiredElements: ['主要', '重要', '关键', '核心'],
        structurePatterns: [
          /^\d+\./m,  // 数字编号
          /^•/m,      // 项目符号
          /^-\s/m,    // 破折号
          /^\*\s/m    // 星号
        ]
      },

      // 内容质量指标
      quality: {
        coherence: {
          minCoherence: 0.6,  // 最小连贯性
          maxRedundancy: 0.3   // 最大冗余度
        },
        relevance: {
          minRelevance: 0.7,   // 最小相关性
          keyTermCoverage: 0.8 // 关键词覆盖率
        },
        completeness: {
          minCoverage: 0.6,    // 最小覆盖率
          topicCoverage: 0.8   // 主题覆盖率
        }
      },

      // 长度控制
      length: {
        short: { min: 100, max: 200, target: 150 },
        medium: { min: 300, max: 500, target: 400 },
        detailed: { min: 800, max: 1200, target: 1000 }
      }
    };
  }

  // 根据页面类型选择合适的模板
  selectTemplate(pageType, contentLength, language) {
    let template = this.promptTemplates.general;
    
    // 根据页面类型选择模板
    if (this.promptTemplates[pageType]) {
      template = this.promptTemplates[pageType];
    }
    
    // 根据内容长度调整模板
    if (contentLength > 5000) {
      // 长内容使用更详细的模板
      template.system += '\n\n对于长内容，请提供更详细的总结，包括多个关键点的深入分析。';
    } else if (contentLength < 500) {
      // 短内容使用简洁模板
      template.system += '\n\n对于短内容，请提供简洁明了的总结。';
    }
    
    // 根据语言调整
    if (language && language !== 'zh-CN') {
      template.system += '\n\n请注意内容可能包含多种语言，请确保总结的准确性。';
    }
    
    return template;
  }

  // 优化提示词
  optimizePrompt(baseTemplate, options = {}) {
    const {
      pageType = 'general',
      contentLength = 1000,
      summaryLength = 'medium',
      language = 'zh-CN',
      userPreferences = {}
    } = options;

    // 选择基础模板
    const template = this.selectTemplate(pageType, contentLength, language);
    
    // 应用用户偏好
    let systemPrompt = template.system;
    let userPrompt = template.user;

    // 根据总结长度偏好调整
    const lengthPrefs = this.optimizationRules.length[summaryLength];
    if (lengthPrefs) {
      systemPrompt += `\n\n请将总结控制在${lengthPrefs.min}-${lengthPrefs.max}字之间，理想长度约${lengthPrefs.target}字。`;
    }

    // 应用其他优化规则
    systemPrompt = this.applyQualityRules(systemPrompt);
    
    return {
      system: systemPrompt,
      user: userPrompt,
      meta: {
        template: pageType,
        language: language,
        targetLength: lengthPrefs?.target,
        optimization: {
          qualityRules: true,
          lengthControl: true,
          coherenceCheck: true
        }
      }
    };
  }

  // 应用质量规则
  applyQualityRules(prompt) {
    const qualityEnhancements = [
      // 添加质量控制指令
      '\n\n质量控制：',
      '- 确保总结的逻辑性和连贯性',
      '- 避免重复表达相同内容',
      '- 保持信息的准确性和完整性',
      '- 使用恰当的标点符号和格式',
      ''
    ].join('\n');

    // 添加风格指导
    const styleGuide = [
      '风格要求：',
      '- 使用正式但易读的语言',
      '- 保持客观中性的语调',
      '- 优先使用短句和清晰的结构',
      '- 避免过于复杂的句式',
      ''
    ].join('\n');

    return prompt + qualityEnhancements + styleGuide;
  }

  // 评估总结质量
  evaluateSummary(summary, originalContent, meta = {}) {
    const evaluation = {
      coherence: this.assessCoherence(summary),
      relevance: this.assessRelevance(summary, originalContent),
      completeness: this.assessCompleteness(summary, originalContent),
      length: this.assessLength(summary, meta.targetLength),
      style: this.assessStyle(summary),
      overall: 0
    };

    // 计算综合得分
    evaluation.overall = (
      evaluation.coherence * 0.25 +
      evaluation.relevance * 0.25 +
      evaluation.completeness * 0.25 +
      evaluation.length * 0.15 +
      evaluation.style * 0.10
    ) * 100;

    return evaluation;
  }

  // 评估连贯性
  assessCoherence(summary) {
    const sentences = summary.split(/[。！？.!?]/).filter(s => s.trim().length > 10);
    if (sentences.length < 2) return 0.5;

    // 简单的连贯性评估
    let transitionScore = 0;
    const transitionWords = ['首先', '其次', '然后', '最后', '此外', '另外', '因此', '所以', '然而', '但是'];
    
    sentences.forEach((sentence, index) => {
      if (index > 0) {
        const hasTransition = transitionWords.some(word => 
          sentence.includes(word) || sentences[index - 1].includes(word)
        );
        if (hasTransition) transitionScore += 1;
      }
    });

    return Math.min(transitionScore / (sentences.length - 1), 1.0);
  }

  // 评估相关性
  assessRelevance(summary, content) {
    if (!content || !summary) return 0.5;

    // 提取关键词
    const contentWords = this.extractKeywords(content, 20);
    const summaryWords = this.extractKeywords(summary, 10);

    // 计算关键词覆盖率
    let coverage = 0;
    contentWords.forEach(word => {
      if (summaryWords.includes(word)) {
        coverage += 1;
      }
    });

    return coverage / Math.min(contentWords.length, 10);
  }

  // 评估完整性
  assessCompleteness(summary, content) {
    if (!content || !summary) return 0.5;

    const contentLength = content.length;
    const summaryLength = summary.length;
    const ratio = summaryLength / contentLength;

    // 合理的总结比例
    if (ratio >= 0.1 && ratio <= 0.5) return 1.0;
    if (ratio >= 0.05 && ratio < 0.1) return 0.8;
    if (ratio > 0.5 && ratio <= 0.8) return 0.8;
    if (ratio > 0.8) return 0.4;
    return 0.5;
  }

  // 评估长度
  assessLength(summary, targetLength) {
    if (!summary || !targetLength) return 0.5;

    const actualLength = summary.length;
    const ratio = actualLength / targetLength;

    if (ratio >= 0.8 && ratio <= 1.2) return 1.0;
    if (ratio >= 0.6 && ratio <= 1.5) return 0.8;
    if (ratio >= 0.4 && ratio <= 2.0) return 0.6;
    return 0.3;
  }

  // 评估风格
  assessStyle(summary) {
    if (!summary) return 0.5;

    let score = 1.0;

    // 检查是否包含应该避免的词汇
    const avoidWords = this.optimizationRules.language.avoidWords;
    avoidWords.forEach(word => {
      if (summary.includes(word)) {
        score -= 0.2;
      }
    });

    // 检查结构化程度
    const hasStructure = /[•\-\*\d+\.]/.test(summary);
    if (hasStructure) {
      score += 0.1;
    }

    // 检查标点符号使用
    const punctuationScore = this.evaluatePunctuation(summary);
    score *= punctuationScore;

    return Math.max(0, Math.min(1, score));
  }

  // 评估标点符号使用
  evaluatePunctuation(text) {
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0.5;

    // 检查句子长度分布
    const lengths = sentences.map(s => s.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;

    // 适度的方差表示较好的句子长度分布
    if (variance > 10 && variance < 200) return 1.0;
    if (variance > 5 && variance < 300) return 0.8;
    return 0.6;
  }

  // 提取关键词
  extractKeywords(text, count = 10) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20)
      .filter(word => !this.isStopWord(word));

    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([word]) => word);
  }

  // 检查停用词
  isStopWord(word) {
    const stopWords = [
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '来', '现在', '对', '时', '把', '给', '被', '用', '个', '第', '还', '后', '中', '下', '过', '后', '还', '能', '所', '以', '各', '二', '来', '所', '些', '同', '全'
    ];
    return stopWords.includes(word);
  }

  // 获取提示词建议
  getSuggestions(evaluation) {
    const suggestions = [];

    if (evaluation.coherence < 0.6) {
      suggestions.push('建议增加逻辑连接词以提高连贯性');
    }

    if (evaluation.relevance < 0.6) {
      suggestions.push('建议更好地覆盖原内容的关键要点');
    }

    if (evaluation.completeness < 0.6) {
      suggestions.push('建议提供更详细或更完整的总结');
    }

    if (evaluation.length < 0.6) {
      suggestions.push('建议调整总结长度以符合目标要求');
    }

    if (evaluation.style < 0.6) {
      suggestions.push('建议使用更客观的表述，避免主观评论');
    }

    return suggestions;
  }
}

// 导出优化器
window.PromptOptimizer = PromptOptimizer;