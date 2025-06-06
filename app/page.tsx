"use client";

import { useState, useEffect, useRef } from 'react';
import { ContentItem, DailyContent, DailyData, ActiveSection, ReviewContent } from '@/app/types/types';

// Removed fixed CARD_WIDTH and CARD_MARGIN_RIGHT as we will use responsive design
// const CARD_WIDTH = 320; // Approximate card width in pixels (tailwind w-80 is 320px)
// const CARD_MARGIN_RIGHT = 16; // Approximate margin between cards (tailwind mr-4 is 16px)

// Removed DRAG_THRESHOLD and SNAP_TRANSITION_DURATION

// 浮动窗口组件
function DetailModal({
  isOpen,
  onClose,
  content
}: {
  isOpen: boolean;
  onClose: () => void;
  content: ContentItem | ReviewContent;
}) {
  if (!isOpen) return null;

  // Handle different content structures (ContentItem vs ReviewContent)
  const title = (content as any).title || (content as any).review_title;
  const contentText = (content as any).content || (content as any).review_content;

  if (!title || !contentText) {
      console.error("Invalid content passed to DetailModal:", content);
      return null; // Or display an error message in the modal
  }

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
              {title}
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
            {/* Use contentText which now handles both title/content and review_title/review_content */}
            {contentText.split('\n').map((paragraph: string, index: number) => (
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
  const [selectedContent, setSelectedContent] = useState<ContentItem | ReviewContent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentTranslateX, setCurrentTranslateX] = useState(0);
  const [previousTranslateX, setPreviousTranslateX] = useState(0);
  const cardContainerRef = useRef<HTMLDivElement>(null); // Ref for the card container
  const mainContentRef = useRef<HTMLElement>(null); // Ref for the main content area

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
    const mainContent = mainContentRef.current;
    if (!cardContainer || !mainContent) return;

    // Add CSS class for smooth transition only when not dragging
    cardContainer.style.transition = isDragging ? 'none' : 'transform 0.3s ease-in-out';

    const onMouseDown = (e: MouseEvent) => {
      // Only start drag if clicking directly on the container, not a child element
      if (e.target !== cardContainer) return;
      setIsDragging(true);
      setStartX(e.clientX);
      setPreviousTranslateX(currentTranslateX);
      // cardContainer.style.transition = 'none'; // Removed, handled by useEffect
    };

    const onTouchStart = (e: TouchEvent) => {
        // Only start drag if touching directly on the container
        if (e.target !== cardContainer) return;
        setIsDragging(true);
        setStartX(e.touches[0].clientX);
        setPreviousTranslateX(currentTranslateX);
        // if (cardContainer) cardContainer.style.transition = 'none'; // Removed, handled by useEffect
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
      // Use a percentage of the main content width for threshold
      const mainContentWidth = mainContent.offsetWidth;
      const switchThreshold = mainContentWidth / 4; // Use a quarter of the visible width as threshold

      // Calculate card width dynamically for positioning
      const cardElement = cardContainer.querySelector('.day-card');
      const cardWidth = (cardElement instanceof HTMLElement) ? cardElement.offsetWidth : 280; // Adjusted default card width slightly smaller
      const cardMarginRight = (cardElement instanceof HTMLElement && cardElement) ? parseFloat(getComputedStyle(cardElement).marginRight) : 16; // Default to 16

      if (dragDistance > switchThreshold && !displayToday) { // Dragged right from yesterday to today
        targetTranslateX = 0; // Position for today
        setDisplayToday(true);
      } else if (dragDistance < -switchThreshold && displayToday) { // Dragged left from today to yesterday
        // Calculate target position dynamically based on card and margin width
        const cardAndMarginWidth = cardWidth + cardMarginRight;
        targetTranslateX = -(cardAndMarginWidth);
        setDisplayToday(false);
      } else {
         // Snap back to the original position if drag threshold not met
         targetTranslateX = previousTranslateX;
      }

      setCurrentTranslateX(targetTranslateX);
      // if (cardContainer) cardContainer.style.transition = 'transform 0.3s ease-in-out'; // Removed, handled by useEffect
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        const dragDistance = currentTranslateX - previousTranslateX;

        // Determine target position based on drag direction and threshold
        let targetTranslateX = previousTranslateX;
        const mainContentWidth = mainContent.offsetWidth;
        const switchThreshold = mainContentWidth / 4;

        // Calculate card width dynamically for positioning
        const cardElement = cardContainer.querySelector('.day-card');
        const cardWidth = (cardElement instanceof HTMLElement) ? cardElement.offsetWidth : 280; // Adjusted default card width slightly smaller
        const cardMarginRight = (cardElement instanceof HTMLElement && cardElement) ? parseFloat(getComputedStyle(cardElement).marginRight) : 16; // Default to 16

        if (dragDistance > switchThreshold && !displayToday) { // Dragged right from yesterday to today
            targetTranslateX = 0; // Position for today
            setDisplayToday(true);
        } else if (dragDistance < -switchThreshold && displayToday) {
            // Calculate target position dynamically based on card and margin width
            const cardAndMarginWidth = cardWidth + cardMarginRight;
            targetTranslateX = -(cardAndMarginWidth);
            setDisplayToday(false);
        } else {
           // Snap back to the original position if drag threshold not met
           targetTranslateX = previousTranslateX;
        }

        setCurrentTranslateX(targetTranslateX);
        // if (cardContainer) cardContainer.style.transition = 'transform 0.3s ease-in-out'; // Removed, handled by useEffect
    };

    // Add event listeners to the specific container element
    cardContainer.addEventListener('mousedown', onMouseDown as EventListener);
    cardContainer.addEventListener('touchstart', onTouchStart as EventListener);

    // Add global event listeners for mouse move and up to ensure dragging works even if cursor leaves the container
    window.addEventListener('mousemove', onMouseMove as EventListener);
    window.addEventListener('mouseup', onMouseUp as EventListener);
    // Add global touch event listeners
    window.addEventListener('touchmove', onTouchMove as EventListener);
    window.addEventListener('touchend', onTouchEnd as EventListener);

    // Cleanup event listeners
    return () => {
      cardContainer.removeEventListener('mousedown', onMouseDown as EventListener);
      cardContainer.removeEventListener('touchstart', onTouchStart as EventListener);
      window.removeEventListener('mousemove', onMouseMove as EventListener);
      window.removeEventListener('mouseup', onMouseUp as EventListener);
      window.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('touchend', onTouchEnd as EventListener);
    };
  }, [isDragging, startX, previousTranslateX, currentTranslateX, displayToday]); // Add dependencies

  // Update currentTranslateX when displayToday changes (for initial positioning or programmatic changes)
  // Also update transform style when currentTranslateX changes
  useEffect(() => {
    const cardContainer = cardContainerRef.current;
    if (cardContainer) {
      // Calculate targetTranslateX dynamically based on potential mobile card width
      const cardElement = cardContainer.querySelector('.day-card');
      const cardWidth = (cardElement instanceof HTMLElement) ? cardElement.offsetWidth : 280; // Adjusted default card width slightly smaller
      const cardMarginRight = (cardElement instanceof HTMLElement && cardElement) ? parseFloat(getComputedStyle(cardElement).marginRight) : 16;
      const targetTranslateX = displayToday ? 0 : -(cardWidth + cardMarginRight);
       // No need to set transition here, handled by drag useEffect
      setCurrentTranslateX(targetTranslateX);
    }
  }, [displayToday]);

    // Apply transform style based on currentTranslateX
    useEffect(() => {
        const cardContainer = cardContainerRef.current;
        if (cardContainer) {
            cardContainer.style.transform = `translateX(${currentTranslateX}px)`;
        }
    }, [currentTranslateX]);

  // Handle content click (only effective on the current card)
  const handleContentClick = (content: ContentItem | ReviewContent) => {
    setSelectedContent(content);
    setIsModalOpen(true);
  };

  // Handle tab click to switch active section
  const handleTabClick = (section: ActiveSection) => {
      // Only update if the tab is not already active
      if (activeSection !== section) {
          setActiveSection(section);
      }
  };

  // Render content display within the card
  const renderContentDisplay = (content: ContentItem | ReviewContent) => {
    // Handle different content structures for display within the card preview
    const title = (content as any).title || (content as any).review_title;
    const contentText = (content as any).content || (content as any).review_content;

    if (!title || !contentText) {
        return <p>内容加载失败或格式错误。</p>;
    }

    return (
      <>
        <h3 className="text-lg font-bold mb-2 line-clamp-1">{title}</h3>
        <p className="text-gray-700 line-clamp-3">{contentText}</p>
      </>
    );
  };

  // Render date card
  const renderDayCard = (content: DailyContent, isToday: boolean) => {
    const isCurrentCard = displayToday === isToday;

    // Determine which section content to display based on activeSection state
    const sectionContent = content ? content[activeSection] : null;

    return (
      <div
        // Use responsive classes for width and margin
        // Reduced max-w-sm to max-w-xs for potentially smaller card on mobile
        className={`day-card flex-none w-full max-w-xs md:max-w-sm lg:w-80 bg-white rounded-xl shadow-lg p-6 flex flex-col transition-all duration-300 mr-4 ${
          isCurrentCard
            ? 'transform scale-100 shadow-xl z-10' // Added z-index to current card
            : 'transform scale-95'
        }`}
        // Removed explicit style width
        // style={{ width: CARD_WIDTH + 'px' }} // Explicitly set card width
        // Removed onClick handler from the card itself
        // onClick={() => handleCardClick(isToday)} 
      >
        <div className="text-right text-sm text-gray-500 mb-4">{content.date}</div>
        {/* 内容区域的点击事件 */}
        {sectionContent ? (
            <div
              className={
                isCurrentCard
                  ? "cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                  : "cursor-default"
              }
              onClick={(e) => {
                if (isCurrentCard && sectionContent) { // Ensure sectionContent exists
                  e.stopPropagation(); // Prevent potential drag issues
                  handleContentClick(sectionContent);
                }
              }}
            >
               {renderContentDisplay(sectionContent)}
               {/* 只有当前卡片显示"查看全文" */}
               {isCurrentCard && (
                 <div className="text-blue-600 hover:underline mt-4 inline-block">查看全文 &rarr;</div>
               )}
            </div>
        ) : (
             <p>加载中...</p> // Or a specific error message if content is null/undefined
        )}

      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-xl">加载中...</div>;
  }

  if (!dailyData) {
      return <div className="flex justify-center items-center min-h-screen text-xl text-red-500">加载内容失败。</div>;
  }

  return (
    // Added horizontal padding on small screens
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start px-2 py-4 overflow-x-hidden sm:px-4 md:px-6 lg:px-8"> {/* Changed justify-center to justify-start, Added overflow-x-hidden, Added responsive padding */}
      <header className="w-full max-w-4xl mx-auto text-center py-8">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-4">文学考研学习助手</h1>
        <p className="text-xl text-gray-600">每日更新 由@Meso制作</p>
      </header>

      {/* Added a wrapper div for horizontal scrolling on mobile */}
      {/* Added horizontal padding here as well for consistent spacing */}
      <div className="w-full overflow-x-auto custom-scrollbar px-2 sm:px-4 md:px-6 lg:px-8"> {/* Added custom-scrollbar class for potential styling, Added responsive padding */}
          <main ref={mainContentRef} className="flex w-max mx-auto py-8"> {/* Added ref, w-max to prevent wrapping, and mx-auto for centering */} {/* Removed overflow-hidden */}
            <div
              ref={cardContainerRef}
              className="flex cursor-grab active:cursor-grabbing"
              style={{
                transform: `translateX(${currentTranslateX}px)`,
                // transition: 'transform 0.3s ease-in-out', // Removed, handled by useEffect
              }}
            >
              {/* Yesterday's Card */}
              {dailyData.yesterday && renderDayCard(dailyData.yesterday, false)}

              {/* Today's Card */}
              {dailyData.today && renderDayCard(dailyData.today, true)}
            </div>
          </main>
      </div>

       {/* Floating Button Container with solid white background */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-full shadow-lg p-2"> {/* Adjusted bottom spacing, added bg-white and padding */}
          <div className="flex space-x-2 md:space-x-4 justify-center"> {/* Added justify-center */} {/* Increased spacing for larger screens */}
              <button
                className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  activeSection === 'review'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleTabClick('review')}
              >
                评论
              </button>
              <button
                className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  activeSection === 'concept'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleTabClick('concept')}
              >
                概念
              </button>
              <button
                className={`px-3 py-1 md:px-4 md:py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                  activeSection === 'question'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => handleTabClick('question')}
              >
                题目
              </button>
          </div>
      </div>

      {/* Render the modal */}
      {selectedContent && (
        <DetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          content={selectedContent}
        />
      )}
    </div>
  );
}
