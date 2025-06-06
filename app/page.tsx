"use client";

import { useState, useEffect, useRef } from 'react';
import { ContentItem, DailyContent, DailyData, ActiveSection } from '@/app/types/types';

const CARD_WIDTH = 320; // Approximate card width in pixels (tailwind w-80 is 320px)
const CARD_MARGIN_RIGHT = 16; // Approximate margin between cards (tailwind mr-4 is 16px)
// Removed DRAG_THRESHOLD and SNAP_TRANSITION_DURATION

// 浮动窗口组件
function DetailModal({
  isOpen,
  onClose,
  content
}: {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 高斯模糊背景 */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/50" onClick={onClose} /> {/* Slightly darker background */}

      {/* 内容卡片 */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-fade-in-up overflow-hidden"> {/* Removed bg-white/95 for solid white */} {/* Added overflow-hidden */}
        {/* 标题栏 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              {content.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-8 overflow-y-auto flex-grow">
          <div className="prose prose-lg max-w-none leading-relaxed text-gray-700"> {/* Combined text styles */}
            {content.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-6">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* 底部装饰 */}
        <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-300"></div> {/* Removed rounded-b-2xl here as it's on the parent div */}
      </div>
    </div>
  );
}

export default function Home() {
  const [displayToday, setDisplayToday] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('review');
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentTranslateX, setCurrentTranslateX] = useState(0);
  const [previousTranslateX, setPreviousTranslateX] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement>(null); // Ref for the card container

  // Fetch data from the API on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/daily-content');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: DailyData = await response.json();
        setDailyData(data);
      } catch (error) {
        console.error("Error fetching daily content:", error);
        // Handle error (e.g., show an error message to the user)
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle drag logic
  useEffect(() => {
    const cardContainer = cardContainerRef.current;
    if (!cardContainer) return;

    const onMouseDown = (e: MouseEvent) => {
      setIsDragging(true);
      setStartX(e.clientX);
      setPreviousTranslateX(currentTranslateX);
      cardContainer.style.transition = 'none'; // Remove transition during drag
    };

    const onTouchStart = (e: TouchEvent) => {
        setIsDragging(true);
        setStartX(e.touches[0].clientX);
        setPreviousTranslateX(currentTranslateX);
        if (cardContainer) cardContainer.style.transition = 'none'; // Remove transition during drag
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const deltaX = currentX - startX;
      setCurrentTranslateX(previousTranslateX + deltaX);
    };

    const onTouchMove = (e: TouchEvent) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;
        setCurrentTranslateX(previousTranslateX + deltaX);
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      const dragDistance = currentTranslateX - previousTranslateX;

      // Determine target position based on drag direction and threshold
      let targetTranslateX = previousTranslateX;
      const switchThreshold = CARD_WIDTH / 4; // Example threshold

      if (dragDistance > switchThreshold && !displayToday) { // Dragged right from yesterday to today
        targetTranslateX = 0; // Position for today
        setDisplayToday(true);
      } else if (dragDistance < -switchThreshold && displayToday) { // Dragged left from today to yesterday
        targetTranslateX = -(CARD_WIDTH + CARD_MARGIN_RIGHT); // Position for yesterday
        setDisplayToday(false);
      } else {
         // Snap back to the original position if drag threshold not met
         targetTranslateX = previousTranslateX;
      }

      setCurrentTranslateX(targetTranslateX);
      if (cardContainer) cardContainer.style.transition = 'transform 0.3s ease-in-out'; // Add transition back
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        const dragDistance = currentTranslateX - previousTranslateX;

        // Determine target position based on drag direction and threshold
        let targetTranslateX = previousTranslateX;
        const switchThreshold = CARD_WIDTH / 4; // Example threshold

        if (dragDistance > switchThreshold && !displayToday) { // Dragged right from yesterday to today
            targetTranslateX = 0; // Position for today
            setDisplayToday(true);
        } else if (dragDistance < -switchThreshold && displayToday) { // Dragged left from today to yesterday
            targetTranslateX = -(CARD_WIDTH + CARD_MARGIN_RIGHT); // Position for yesterday
            setDisplayToday(false);
        } else {
           // Snap back to the original position if drag threshold not met
           targetTranslateX = previousTranslateX;
        }

        setCurrentTranslateX(targetTranslateX);
        if (cardContainer) cardContainer.style.transition = 'transform 0.3s ease-in-out'; // Add transition back
    };

    // Add event listeners
    cardContainer.addEventListener('mousedown', onMouseDown);
    cardContainer.addEventListener('touchstart', onTouchStart);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onTouchEnd);

    // Cleanup event listeners
    return () => {
      cardContainer.removeEventListener('mousedown', onMouseDown);
      cardContainer.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, startX, previousTranslateX, currentTranslateX, displayToday]); // Add dependencies

  // Update currentTranslateX when displayToday changes (for initial positioning or programmatic changes)
  useEffect(() => {
    setCurrentTranslateX(displayToday ? 0 : -(CARD_WIDTH + CARD_MARGIN_RIGHT));
  }, [displayToday]);

  // 处理内容点击（仅在当前卡片有效）
  const handleContentClick = (content: ContentItem) => {
    setSelectedContent(content);
    setIsModalOpen(true);
  };

  // 渲染内容卡片（这部分只渲染内容，点击逻辑在外部处理）
  const renderContentDisplay = (content: ContentItem) => (
    <>
      <h3 className="text-lg font-bold mb-2 line-clamp-1">{content.title}</h3>
      <p className="text-gray-700 line-clamp-3">{content.content}</p>
    </>
  );

  // 渲染日期卡片
  const renderDayCard = (content: DailyContent, isToday: boolean) => {
    const isCurrentCard = displayToday === isToday;
    return (
      <div
        className={`flex-none w-80 bg-white rounded-xl shadow-lg p-6 flex flex-col transition-all duration-300 ${
          isCurrentCard
            ? 'transform scale-100 shadow-xl z-10' // Added z-index to current card
            : 'transform scale-95' // Removed cursor-pointer and hover effect as click is now drag/content based
        }`}
        // Removed onClick handler from the card itself
        // onClick={() => handleCardClick(isToday)} 
      >
        <div className="text-right text-sm text-gray-500 mb-4">{content.date}</div>
        {/* 内容区域的点击事件 */}
        <div
          className={
            isCurrentCard
              ? "cursor-pointer hover:bg-gray-50 transition-colors duration-200"
              : "cursor-default"
          }
          onClick={(e) => {
            if (isCurrentCard) {
              e.stopPropagation(); // Prevent potential drag issues
              handleContentClick(content[activeSection]);
            }
          }}
        >
           {renderContentDisplay(content[activeSection])}
           {isCurrentCard && (
              <div className="mt-2 text-blue-500 text-sm flex items-center">
                <span>点击查看全文</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
        </div>
      </div>
    );
  };

  // Show loading state
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">加载中...</div>;
  }

  // Show error state
  if (!dailyData) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">加载内容失败！</div>;
  }

  // Render content once data is loaded
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 relative">
      {/* 顶部按钮组 */}
      <div className="flex justify-center space-x-4 p-2 absolute top-4 left-0 right-0 z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-full shadow-lg px-4 py-2 flex space-x-2">
          <button
            className={`px-4 py-1 rounded-full transition-all duration-200 ${
              activeSection === 'review'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-800 hover:bg-gray-100'
            }`}
            onClick={() => setActiveSection('review')}
          >
            文学评论
          </button>
          <button
            className={`px-4 py-1 rounded-full transition-all duration-200 ${
              activeSection === 'concept'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-800 hover:bg-gray-100'
            }`}
            onClick={() => setActiveSection('concept')}
          >
            概念解释
          </button>
          <button
            className={`px-4 py-1 rounded-full transition-all duration-200 ${
              activeSection === 'question'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-800 hover:bg-gray-100'
            }`}
            onClick={() => setActiveSection('question')}
          >
            考研题目
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <main className="flex-grow flex items-center justify-center p-4 overflow-hidden relative mt-20">
        {/* 卡片容器 - 使用flex布局 */} {/* Removed fixed width here, let flex determine */}
        {/* Applied transform for centering */} {/* Increased width to ensure cards don't overflow during scaling */}
        {/* Note: the flex container itself is centered by main. The transform shifts the *contents* of this flex container. */}
        <div
          ref={cardContainerRef} // Attach ref here
          className="flex transition-transform duration-500 ease-in-out space-x-8" // Added space-x-8 here
          style={{ transform: `translateX(${currentTranslateX}px)` }} // Apply dynamic transform
        >

          {/* 昨天的卡片 */}
          {dailyData.yesterday && renderDayCard(dailyData.yesterday, false)}

          {/* 今天的卡片 */}
          {dailyData.today && renderDayCard(dailyData.today, true)}
        </div>
      </main>

      {/* 浮动窗口 */}
      <DetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={selectedContent || { title: '', content: '' }}
      />
    </div>
  );
}
