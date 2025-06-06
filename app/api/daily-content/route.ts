import { generateDailyContent, AIConfig } from '@/app/utils/ai';
import { createClient, SupabaseClient, PostgrestSingleResponse } from '@supabase/supabase-js'; // Import Supabase types
import { NextResponse } from 'next/server';
import { DailyContent, DailyData } from '@/app/types/types'; // Import DailyContent and DailyData types

// Define a type for the structure fetched directly from the Supabase table
interface DailyContentRow {
    id: number;
    created_at: string;
    date: string;
    review_title: string;
    review_content: string;
    review_author: string | null;
    review_tag: string | null;
    review_source: string | null;
    concept_title: string;
    concept_content: string;
    question_title: string;
    question_content: string;
}

// Initialize Supabase client (using Service Role Key for backend operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase URL or Service Role Key in environment variables.");
  throw new Error("Server configuration error: Database credentials are not set.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

// Helper function to validate required environment variables for AI
function validateAIConfig(): AIConfig {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const modelId = process.env.SILICONFLOW_MODEL_ID;

  if (!apiKey || !modelId) {
    console.error("Missing SiliconFlow API Key or Model ID in environment variables.");
    throw new Error("Server configuration error: AI API credentials are not set.");
  }

  return { apiKey, modelId };
}

export async function GET() {
  try {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD

    console.log(`Attempting to fetch content for date: ${todayString}`);

    // 1. Try to fetch today's content from DB
    const { data: todayData, error: fetchTodayError }: PostgrestSingleResponse<DailyContentRow> = await supabase
      .from('daily_content')
      .select('*')
      .eq('date', todayString)
      .single();

    console.log("Fetch today's content result:", { todayData, fetchTodayError });

    let currentDayContent: DailyContent | null = null;

    if (fetchTodayError && fetchTodayError.code !== 'PGRST116') {
        console.error("Error fetching today's content from Supabase:", fetchTodayError);
        throw new Error(`Database fetch error: ${fetchTodayError.message}`);
    }

    if (todayData) {
      console.log("Today's content found in DB.");
      currentDayContent = { // Map DB row to DailyContent type
        date: todayData.date,
        review: { title: todayData.review_title, content: todayData.review_content, author: todayData.review_author || undefined, tag: todayData.review_tag || undefined, source: todayData.review_source || undefined },
        concept: { title: todayData.concept_title, content: todayData.concept_content },
        question: { title: todayData.question_title, content: todayData.question_content },
      };
    } else {
      console.log("Today's content not found in DB, generating new content...");
      const aiConfig = validateAIConfig();
      const generatedContent: DailyData = await generateDailyContent(aiConfig); // Specify expected return type
      console.log("AI generated content successfully.");

      const contentToInsert: Omit<DailyContentRow, 'id' | 'created_at'> = { // Specify type for insert data
        date: todayString,
        review_title: generatedContent.today.review.title,
        review_content: generatedContent.today.review.content,
        review_author: generatedContent.today.review.author || null,
        review_tag: generatedContent.today.review.tag || null,
        review_source: generatedContent.today.review.source || null,
        concept_title: generatedContent.today.concept.title,
        concept_content: generatedContent.today.concept.content,
        question_title: generatedContent.today.question.title,
        question_content: generatedContent.today.question.content,
      };

      console.log("Attempting to insert content:", contentToInsert);

      const { data: insertedData, error: insertError }: PostgrestSingleResponse<null> = await supabase // Specify return type
        .from('daily_content')
        .insert([contentToInsert]);

      console.log("Insert result:", { insertedData, insertError });

      if (insertError) {
        console.error("Error inserting today's content into Supabase:", insertError);
      } else {
          console.log(`Successfully inserted content for date ${todayString} into DB.`);
      }

       currentDayContent = { // Use the generated content with proper type
            date: todayString,
            review: { title: generatedContent.today.review.title, content: generatedContent.today.review.content, author: generatedContent.today.review.author || undefined, tag: generatedContent.today.review.tag || undefined, source: generatedContent.today.review.source || undefined },
            concept: { title: generatedContent.today.concept.title, content: generatedContent.today.concept.content },
            question: { title: generatedContent.today.question.title, content: generatedContent.today.question.content },
       };
    }

    // 2. Fetch yesterday's content from DB
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    console.log(`Attempting to fetch content for date: ${yesterdayString}`);

    const { data: yesterdayData, error: fetchYesterdayError }: PostgrestSingleResponse<DailyContentRow> = await supabase // Specify return type
      .from('daily_content')
      .select('*')
      .eq('date', yesterdayString)
      .single();

    console.log("Fetch yesterday's content result:", { yesterdayData, fetchYesterdayError });

    let previousDayContent: DailyContent | null = null;

    if (fetchYesterdayError && fetchYesterdayError.code !== 'PGRST116') {
        console.error("Error fetching yesterday's content from Supabase:", fetchYesterdayError);
    }

    if (yesterdayData) {
        console.log("Yesterday's content found in DB.");
        previousDayContent = { // Map DB row to DailyContent type
            date: yesterdayData.date,
            review: { title: yesterdayData.review_title, content: yesterdayData.review_content, author: yesterdayData.review_author || undefined, tag: yesterdayData.review_tag || undefined, source: yesterdayData.review_source || undefined },
            concept: { title: yesterdayData.concept_title, content: yesterdayData.concept_content },
            question: { title: yesterdayData.question_title, content: yesterdayData.question_content },
        };
    } else {
        console.log("Yesterday's content not found in DB.");
         previousDayContent = {
             date: yesterdayString,
             review: { title: '昨日内容待生成', content: '请等待AI生成昨日内容' },
             concept: { title: '昨日内容待生成', content: '请等待AI生成昨日内容' },
             question: { title: '昨日内容待生成', content: '请等待AI生成昨日内容' },
         };
    }

     if (!currentDayContent) {
         console.error("Critical error: currentDayContent is null after fetch/generate.");
         return new NextResponse(JSON.stringify({ error: "Failed to retrieve or generate today's content." }), { status: 500 });
     }

    return NextResponse.json({ today: currentDayContent, yesterday: previousDayContent });
  } catch (error: unknown) { // Use unknown for broader error handling
    console.error("Error in API route:", error);
    // Provide a more robust way to extract error message from unknown type
    let errorMessage = "An unexpected error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
       // Check if the object has a 'message' property that is a string, without using 'any'
       const potentialErrorObj = error as { message?: unknown };
       if (typeof potentialErrorObj.message === 'string') {
         errorMessage = potentialErrorObj.message;
       }
    }

    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}