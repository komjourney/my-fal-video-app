// components/VideoGenerator.jsx

"use client";

// --- 新增/修改 ---: 导入 useEffect 用于清理图片预览URL
import { useState, useEffect } from 'react';
import { fal } from "@fal-ai/client";

// 配置 fal 客户端，使用代理 (无需修改)
fal.config({
   proxyUrl: "/api/fal/proxy",
});

// --- 新增/修改 ---: 定义常量，避免手打出错
const MODEL_ID_VEO3 = "fal-ai/veo3";
const MODEL_ID_KLING = "fal-ai/kling-video/v1/standard/image-to-video"; // [2]

// Veo3 参数默认值和选项
const VEO3_DEFAULTS = {
   duration: '8s',
   aspectRatio: '16:9',
   durationOptions: [{ value: '8s', label: '8秒 (8s)' }],
   aspectRatioOptions: [
      { value: '16:9', label: '16:9 (横屏)' },
      { value: '9:16', label: '9:16 (竖屏)' },
   ],
};

// Kling 参数默认值和选项
const KLING_DEFAULTS = {
   duration: '5', // [4]
   aspectRatio: '16:9', // [4]
   negativePrompt: 'blur, distort, and low quality', // [4]
   cfgScale: '0.5', // [4] 使用字符串，方便input value
   durationOptions: [ // [4]
      { value: '5', label: '5秒' },
      { value: '10', label: '10秒' },
   ],
   aspectRatioOptions: [ // [4]
      { value: '16:9', label: '16:9 (横屏)' },
      { value: '9:16', label: '9:16 (竖屏)' },
      { value: '1:1', label: '1:1 (方屏)' }, // Kling 多一个 1:1
   ],
};
// --- 常量定义结束 ---


// UI组件主体
export function VideoGenerator() {
   // --- 定义状态 (State) ---

   // --- 新增/修改 ---: 记录当前选中的模型ID，默认Veo3
   const [selectedModel, setSelectedModel] = useState(MODEL_ID_VEO3);
   // --- 新增/修改 ---: 增加一个变量，方便判断当前是否选中Kling
   const isKling = selectedModel === MODEL_ID_KLING;

   const [prompt, setPrompt] = useState('');
   // --- 新增/修改 ---: 默认值根据模型来
   const [duration, setDuration] = useState(VEO3_DEFAULTS.duration);
   const [aspectRatio, setAspectRatio] = useState(VEO3_DEFAULTS.aspectRatio);

   // --- 新增/修改 ---: Kling 独有状态
   const [imageFile, setImageFile] = useState(null); // 存放用户选择的 File 对象，用于上传
   const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // 存放本地图片预览地址
   const [negativePrompt, setNegativePrompt] = useState(KLING_DEFAULTS.negativePrompt);
   const [cfgScale, setCfgScale] = useState(KLING_DEFAULTS.cfgScale);

   const [videoUrl, setVideoUrl] = useState(null);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState(null);
   const [logs, setLogs] = useState([]);

   // --- 新增/修改 ---: 状态和选项，用于动态显示下拉菜单
   const [durationOptions, setDurationOptions] = useState(VEO3_DEFAULTS.durationOptions);
   const [aspectRatioOptions, setAspectRatioOptions] = useState(VEO3_DEFAULTS.aspectRatioOptions);


   // --- 新增/修改 ---: 副作用 Hook
   // 1. 清理图片预览 URL，防止内存泄漏
   useEffect(() => {
      // 组件卸载或 imagePreviewUrl 变化时执行清理
      return () => {
         if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
         }
      };
   }, [imagePreviewUrl]); // 依赖项是 imagePreviewUrl

   // --- 新增/修改 ---: 核心函数 - 处理模型切换
   const handleModelChange = (newModelId) => {
      console.log("切换模型到:", newModelId);
      setSelectedModel(newModelId);
      // !! 关键：切换模型时，重置所有参数和状态 !!
      setPrompt('');
      setVideoUrl(null);
      setError(null);
      setLogs([]);
      setImageFile(null);
      setImagePreviewUrl(null); // 清空图片预览

      if (newModelId === MODEL_ID_KLING) {
         // 如果切换到 Kling，设置 Kling 的默认值和选项
         setDuration(KLING_DEFAULTS.duration);
         setAspectRatio(KLING_DEFAULTS.aspectRatio);
         setNegativePrompt(KLING_DEFAULTS.negativePrompt);
         setCfgScale(KLING_DEFAULTS.cfgScale);
         setDurationOptions(KLING_DEFAULTS.durationOptions);
         setAspectRatioOptions(KLING_DEFAULTS.aspectRatioOptions);
      } else {
         // 否则（切换到 Veo3），设置 Veo3 的默认值和选项
         setDuration(VEO3_DEFAULTS.duration);
         setAspectRatio(VEO3_DEFAULTS.aspectRatio);
         // Veo3没有这些参数，清空
         setNegativePrompt('');
         setCfgScale('');
         setDurationOptions(VEO3_DEFAULTS.durationOptions);
         setAspectRatioOptions(VEO3_DEFAULTS.aspectRatioOptions);
      }
   };

   // --- 新增/修改 ---: 处理文件选择
   const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
         // 1. 存储文件对象，用于上传
         setImageFile(file);
         // 2. 创建一个本地URL用于图片预览
         setImagePreviewUrl(URL.createObjectURL(file));
      } else {
         // 用户取消选择
         setImageFile(null);
         setImagePreviewUrl(null);
      }
   };


   // --- 定义生成按钮点击后要执行的函数 ---
   const handleGenerate = async () => {
      // --- 新增/修改 ---: 增加对Kling模型的图片校验
      if (isLoading || !prompt.trim() || (isKling && !imageFile)) {            // --- 新增/修改 ---: 只有在不是loading状态下才设置错误，避免覆盖加载日志          
         if (!isLoading && isKling && !imageFile) setError("使用 Kling 模型必须上传一张起始图片。");
         return;
      }

      // 1. 设置状态
      setIsLoading(true);
      setError(null);
      setVideoUrl(null)
      setLogs(["任务开始..."]); // 清空并设置初始日志

      try { // <<< 问题 2: 添加 try 块开始

         let inputPayload = {};

         // --- 新增/修改 ---: 动态构建 input 参数包
         if (isKling) {

            setLogs(current => [...current, "准备参数 (图片将自动上传)..."]);
            // Kling 的参数包 [3, 4]
            inputPayload = {
               prompt: prompt,
               // --- 核心修改 ---: 
               // 旧: image_url: uploadedImageUrl, 
               // 新: 直接传入 File 对象，让 fal client 自动上传 [3]
               image_url: imageFile,
               duration: duration, // "5" or "10"
               aspect_ratio: aspectRatio,
               negative_prompt: negativePrompt,
               cfg_scale: parseFloat(cfgScale) || 0.5,
            };
         } else {
            // Veo3 的参数包
            inputPayload = {
               prompt: prompt,
               aspect_ratio: aspectRatio,
               duration: duration, // "8s"
            };
         }

         // --- 新增/修改 ---: 如果是自动上传，日志提前 
         if (isKling) {
            setLogs(current => [...current, `正在调用模型 (含图片上传) ${selectedModel} ...`]);
         } else {
            setLogs(current => [...current, `正在调用模型 ${selectedModel} ...`]);
         }
         console.log(`开始请求 fal.ai, 模型: ${selectedModel}, 参数:`, inputPayload);

         // 2. 调用 fal.ai
         // --- 新增/修改 ---: 传入动态的模型ID和动态的参数包
         const result = await fal.subscribe(selectedModel, { // 使用状态里的模型ID
            input: inputPayload, // 使用动态构建的参数包
            pollInterval: 3000,
            logs: true, // [2]
            onQueueUpdate: (update) => {
               // 自动上传的日志可能也会在这里出现
               console.log("Queue update:", update);
               if (update.logs) {
                  setLogs(currentLogs => [...currentLogs, ...update.logs.map(log => log.message).filter(msg => msg)]);
               }
               // 增加状态显示，更清晰
               if (update.status && !currentLogs.some(log => log.includes(`当前状态: ${update.status}`))) {
                  setLogs(currentLogs => [...currentLogs, `当前状态: ${update.status}`]);
               }
            },
         });

         // 3. 成功！(两个模型输出结构一致 [5])
         if (result && result.video && result.video.url) {
            setVideoUrl(result.video.url); // [5] 
            setLogs(current => [...current, "视频生成成功！"]); console.log("视频生成成功 URL:", result.video.url);
         } else {
            // --- 新增/修改 ---: 把完整结果也记录到日志 
            setError(`生成成功，但未返回视频地址。查看日志获取完整结果。`);
            setLogs(current => [...current, `错误：未返回视频地址。完整结果: ${JSON.stringify(result)}`]);
            console.log("完整结果:", result);
         }

      } catch (err) {
         // 4. 失败！ (自动上传如果失败，错误会在这里被捕获)
         console.error("生成视频或图片上传出错:", err);
         // --- 新增/修改 ---: JSON.stringify(err) 有时没用，加上 .toString()
         const errorMessage = '处理失败: ' + (err.message || err.toString() || JSON.stringify(err) || '未知错误')
         setError(errorMessage);
         setLogs(current => [...current, errorMessage]);
      } finally {
         // 5. 停止加载
         setIsLoading(false);
         console.log("请求结束.");
      }
   };

   // --- 返回 UI 界面 ---
   // --- 新增/修改 ---: 按钮禁用逻辑增加了对Kling图片的要求
   const isButtonDisabled = isLoading || !prompt.trim() || (isKling && !imageFile);

   return (
      <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6">
         <h1 className="text-2xl font-bold text-center text-gray-900">AI 视频生成器</h1>

         {/* --- 新增/修改 ---: 模型选择 */}
         <div className="space-y-2">
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">选择模型</label>
            <select
               id="model"
               className="w-full p-2 border border-gray-300 rounded-md"
               value={selectedModel}
               // 调用模型切换函数，并传入 event.target.value (新的模型ID)
               onChange={(e) => handleModelChange(e.target.value)}
               disabled={isLoading}
            >
               <option value={MODEL_ID_VEO3}>Google Veo3 (文生视频)</option>
               <option value={MODEL_ID_KLING}>Kling V1 (图生视频)</option>
            </select>
         </div>

         {/* --- 新增/修改 ---: Kling 专属：图片上传和预览。 用 { isKling && (...) } 包裹起来，实现动态显示/隐藏 */}
         {isKling && (
            <div className="space-y-2 border border-dashed border-indigo-300 p-3 rounded-md">
               <label htmlFor="imageUpload" className="block text-sm font-medium text-gray-700">上传起始图片 (Kling必需) *</label>
               <input
                  id="imageUpload"
                  type="file" // 类型为文件
                  accept="image/*" // 只接受图片类型
                  className="block w-full text-sm text-gray-500
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-indigo-50 file:text-indigo-700
                     hover:file:bg-indigo-100"
                  onChange={handleFileChange} // 绑定文件选择处理函数
                  disabled={isLoading}
               />
               {/* 图片预览 */}
               {imagePreviewUrl && (
                  <div className="mt-2 flex justify-center">
                     <img src={imagePreviewUrl} alt="Preview" className="max-h-40 rounded-md shadow" />
                  </div>
               )}
            </div>
         )}

         {/* 提示词输入 (通用) */}
         <div className="space-y-2">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">输入提示词 (Prompt) *</label>
            <textarea
               id="prompt"
               rows={3}
               className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
               placeholder={isKling ? "描述图片如何动起来，例如：Snowflakes fall as a car moves forward along the road." : "描述你想生成的视频内容，例如：A casual street interview..."}
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               disabled={isLoading}
            />
         </div>

         {/* --- 新增/修改 ---: Kling 专属：反向提示词 */}
         {isKling && (
            <div className="space-y-2">
               <label htmlFor="negativePrompt" className="block text-sm font-medium text-gray-700">反向提示词 (Negative Prompt)</label>
               <input
                  type="text"
                  id="negativePrompt"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  disabled={isLoading}
               />
            </div>
         )}


         {/* 参数设置 (动态选项) */}
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 画面比例 */}
            <div className="space-y-2">
               <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-700">画面比例 (Aspect Ratio)</label>
               <select
                  id="aspectRatio"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  disabled={isLoading}
               >
                  {/* --- 新增/修改 ---: 动态渲染 options 列表 */}
                  {aspectRatioOptions.map(opt => (
                     <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
               </select>
            </div>
            {/* 时长 */}
            <div className="space-y-2">
               <label htmlFor="duration" className="block text-sm font-medium text-gray-700">时长 (Duration)</label>
               <select
                  id="duration"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={isLoading}
               >
                  {/* --- 新增/修改 ---: 动态渲染 options 列表 */}
                  {durationOptions.map(opt => (
                     <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
               </select>
            </div>
            {/* --- 新增/修改 ---: Kling 专属：CFG Scale */}
            {isKling && (
               <div className="space-y-2">
                  <label htmlFor="cfgScale" className="block text-sm font-medium text-gray-700">CFG Scale (0-10)</label>
                  <input
                     type="number" // 数字输入框
                     id="cfgScale"
                     step="0.1" // 步长
                     min="0"
                     max="10"
                     className="w-full p-2 border border-gray-300 rounded-md"
                     value={cfgScale}
                     onChange={(e) => setCfgScale(e.target.value)}
                     disabled={isLoading}
                  />
               </div>
            )}
         </div>

         {/* 生成按钮 */}
         <button
            className={`w-full py-2 px-4 rounded-md text-white font-semibold ${isButtonDisabled ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
               }`}
            onClick={handleGenerate}
            // --- 新增/修改 ---: 使用新的禁用逻辑
            disabled={isButtonDisabled}
         >
            {isLoading ? '正在处理，请稍候...' : '生成视频'}
         </button>

         {/* 状态和结果显示区 */}
         <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]">
            {error && <div className="text-red-500 text-center mb-2">{error}</div>}
            {/* 加载中提示 & 日志 */}
            {isLoading && (
               <div className="text-center text-gray-500">
                  <p>任务正在处理中 (上传/模型启动/渲染)，请耐心等待...</p>
                  {/* 滚动日志区 */}
                  <div className="mt-2 text-xs text-left bg-gray-100 p-2 rounded max-h-48 overflow-y-auto font-mono break-words">
                     {logs.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)}
                  </div>
               </div>
            )}
            {/* 视频显示 */}
            {videoUrl && !isLoading && (
               <div className="flex justify-center">
                  <video controls src={videoUrl} className="max-w-full rounded-md shadow-lg" autoPlay loop muted playsInline />
               </div>
            )}
            {/* 初始提示 */}
            {!isLoading && !videoUrl && !error && (
               <div className="text-center text-gray-400">生成的视频将在此处显示</div>
            )}
            {/* 只有错误没有加载时 */}
            {!isLoading && error && !videoUrl && (
               <div className="text-center text-gray-400">请检查错误信息并重试</div>
            )}
         </div>
      </div>
   );
}
// 默认导出
export default VideoGenerator;