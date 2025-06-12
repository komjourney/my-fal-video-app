// app/page.js
import VideoGenerator from '@/components/VideoGenerator'; // 导入我们刚写的组件

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
       {/* 使用我们的组件 */}
      <VideoGenerator /> 
    </main>
  );
}