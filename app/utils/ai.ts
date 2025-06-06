import { ContentItem, DailyData, AIConfig, ReviewContent } from '@/app/types/types'; // Import types including ReviewContent

// Moved AIConfig interface here for consistency after creating types file
export type { AIConfig };

// 定义用于生成不同类型内容的提示词
const REVIEW_PROMPT = `请生成一篇关于某部经典文学作品的评论，要求：
- 评论标题
- 评论内容（500字左右）
- 评论作者（虚构名称）
- 可以包含标签（例如：#经典 #文学评论）
- 可以包含出处（例如：摘自《读书杂志》某年某期）
请以JSON格式返回，包含review_title, review_content, review_author, review_tag, review_source字段。`;

const CONCEPT_PROMPT = `请解释一个文学概念或术语，要求：
- 概念名称作为标题
- 简明扼要的解释（150字左右）
- 可以包含具体的文学例子
- 解释要准确且易于理解
请以JSON格式返回，包含title和content字段。`;

const QUESTION_PROMPT = `请生成一道文学考研题目，要求：
- 题目要符合考研难度
- 包含具体的分析要求
- 题目要有一定的深度和学术性
请以JSON格式返回，包含title和content字段。`;

// 生成不同类型的内容
export async function generateDailyContent(config: AIConfig): Promise<DailyData> {
  const prompts = {
    review: REVIEW_PROMPT,
    concept: CONCEPT_PROMPT,
    question: QUESTION_PROMPT,
  };

  // 调用 AI API 生成内容
  async function generateContent(config: AIConfig, prompt: string): Promise<ContentItem | ReviewContent> { // Allow returning either ContentItem or ReviewContent
    // 使用官方文档中的 API 地址
    const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
    const method = 'POST';

    const body = JSON.stringify({
      model: config.modelId,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.7,
      top_k: 50,
      frequency_penalty: 0.5,
      n: 1,
      response_format: {
        type: 'text'
      }
    });

    try {
      console.log('Sending request to SiliconFlow API with body:', {
        ...JSON.parse(body),
        model: config.modelId
      });

      // 添加超时设置
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 60000); // Increased timeout to 60 seconds

      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body,
          signal: controller.signal
        });

        clearTimeout(timeout);

        const responseData = await response.json();
        console.log('SiliconFlow API Response:', JSON.stringify(responseData, null, 2));

        if (!response.ok) {
          const errorMessage = responseData.error?.message || response.statusText;
          console.error('API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: responseData.error,
            headers: Object.fromEntries(response.headers.entries())
          });

          // 根据文档中的状态码处理特定错误
          switch (response.status) {
            case 400:
              throw new Error(`请求参数错误: ${errorMessage}`);
            case 401:
              throw new Error('API密钥无效或未授权');
            case 404:
              throw new Error('请求的资源不存在');
            case 429:
              throw new Error('请求频率超限，请稍后重试');
            case 503:
              throw new Error('服务暂时不可用，请稍后重试');
            case 504:
              throw new Error('服务响应超时，请稍后重试');
            default:
              throw new Error(`API请求失败 (${response.status}): ${errorMessage}`);
          }
        }

        // From response, the generated content is at responseData.choices[0].message.content
        const generatedText: string = responseData.choices[0].message.content;

        // Attempt to extract JSON string from potentially mixed content
        let jsonString = generatedText;
        const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        } else {
          // Fallback if no code block markdown, try to find the first/last curly braces
          const firstBrace = generatedText.indexOf('{');
          const lastBrace = generatedText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonString = generatedText.substring(firstBrace, lastBrace + 1);
          }
        }

        try {
          // Parse the extracted JSON string
          const parsedContent: any = JSON.parse(jsonString); // Use any temporarily for flexible access
          console.log("Parsed AI content (raw):", parsedContent); // Log raw parsed content

          let validatedContent: ContentItem | ReviewContent;

          // Validate parsed content structure based on prompt type
          if (prompt === REVIEW_PROMPT) { // Use constant for comparison
            // Expecting ReviewContent structure
            if (typeof parsedContent.review_title !== 'string' || typeof parsedContent.review_content !== 'string') {
              throw new Error("AI response format is incorrect for review: missing review_title or review_content.");
            }
            // Map to ReviewContent structure for consistency downstream
            validatedContent = {
                title: parsedContent.review_title,
                content: parsedContent.review_content,
                author: parsedContent.review_author,
                tag: parsedContent.review_tag,
                source: parsedContent.review_source
            } as ReviewContent;
          } else { // For concept and question, use constants for comparison
            // Expecting ContentItem structure for concept and question
             if (typeof parsedContent.title !== 'string' || typeof parsedContent.content !== 'string') {
               throw new Error("AI response format is incorrect: missing title or content.");
            }
            validatedContent = parsedContent as ContentItem; // Cast to ContentItem
          }

          console.log("Validated AI content:", validatedContent); // Log validated content

          return validatedContent;

        } catch (parseError: unknown) {
           console.error("Failed to parse or validate AI response JSON:", jsonString, parseError);
           const rawTextSnippet = generatedText.substring(0, Math.min(generatedText.length, 200));

           let parseErrorMessage = "Unknown parsing or validation error.";
           if (parseError instanceof Error) {
             parseErrorMessage = parseError.message;
           } else if (typeof parseError === 'object' && parseError !== null) {
             const potentialErrorObj = parseError as { message?: unknown };
             if (typeof potentialErrorObj.message === 'string') {
               parseErrorMessage = potentialErrorObj.message;
             }
           }

           // Escape backticks in variables before inserting into template literal
           const escapedParseErrorMessage = parseErrorMessage.replace(/`/g, '\\`');
           const escapedRawTextSnippet = rawTextSnippet.replace(/`/g, '\\`');

           throw new Error(`Failed to parse AI response: ${escapedParseErrorMessage}. Raw snippet: ${escapedRawTextSnippet}...`);
        }

      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('API请求超时，请稍后重试');
          }
          if (error.name === 'TypeError' && error.message.includes('fetch failed')) {
            throw new Error('无法连接到API服务器，请检查网络连接或稍后重试');
          }
        }
        // Re-throw other errors
        throw error;
      }
    } catch (error) {
      console.error('Error calling SiliconFlow API:', error);
      // 添加重试逻辑
      if (error instanceof Error && (
        error.message.includes('超时') ||
        error.message.includes('无法连接到API服务器') ||
        error.message.includes('服务暂时不可用') ||
        error.message.includes('服务响应超时') ||
        // Retry on parsing errors as the AI might return incorrect format sometimes
        error.message.includes('Failed to parse AI response')
      )) {
        console.log('Retrying API call...');
        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Pass config when retrying
        return generateContent(config, prompt);
      }
      // Re-throw if not a retryable error
      throw error;
    }
  }

  try {
    // 并行生成所有内容
    const [reviewResult, conceptResult, questionResult] = await Promise.all([
      generateContent(config, prompts.review), // Pass config
      generateContent(config, prompts.concept), // Pass config
      generateContent(config, prompts.question) // Pass config
    ]);

    // parseContent is no longer needed as generateContent now returns parsed JSON

    // Construct DailyData object
    const todayDate = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    return {
      today: {
        date: todayDate,
        // review, concept, and question are already ContentItem or ReviewContent from generateContent
        review: reviewResult as ReviewContent, // Cast reviewResult to ReviewContent
        concept: conceptResult as ContentItem, // Cast conceptResult to ContentItem
        question: questionResult as ContentItem // Cast questionResult to ContentItem
      },
      yesterday: {
        date: yesterdayDate,
        review: { title: '昨日文学评论', content: '昨日评论内容' },
        concept: { title: '昨日文学概念', content: '昨日概念内容' },
        question: { title: '昨日考研题目', content: '昨日题目内容' }
      }
    };
  } catch (error) {
    console.error('Error generating daily content:', error);
    throw error;
  }
} 