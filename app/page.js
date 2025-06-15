// app/page.js

import VideoGenerator from '@/components/VideoGenerator'; // 导入我们刚升级的组件

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* 使用我们的组件 */}
      <VideoGenerator /> 
    </main>
  );
}