// components/VideoGenerator.jsx (版本 v3.2 - 最终修复版)

"use client";

import { useState, useEffect } from 'react';
import { fal } from "@fal-ai/client";

// --- 代理配置 ---
fal.config({
  proxyUrl: "/api/fal/proxy",
});

// =======================================================================
// ===================  AI 模型总开关 (中央配置文件)  ===================
// =======================================================================
const MODELS_CONFIG = [
  { id: "fal-ai/bytedance/seedance/v1/pro/image-to-video", name: "Seedance v1 (图生视频)", type: 'video', isLongRunning: true, isActive: true, defaults: { motion_bucket_id: 127, cond_aug: 0.02, negative_prompt: 'blurry, low quality, distortion, low resolution', } },
  { id: "fal-ai/minimax/hailuo-02/pro/image-to-video", name: "Hailuo-02 (海螺02 图生视频 支持中文)", type: 'video', isLongRunning: true, isActive: true, defaults: { duration: '6', prompt_optimizer: true, durationOptions: [ { value: '6', label: '6秒' }, { value: '10', label: '10秒 (可能降为6秒)' } ], } },
  { id: "fal-ai/minimax/hailuo-02/pro/text-to-video", name: "Hailuo-02 (海螺02 文生视频 支持中文)", type: 'video', isLongRunning: true, isActive: true, defaults: { duration: '6', prompt_optimizer: true, durationOptions: [ { value: '6', label: '6秒' }, { value: '10', label: '10秒 (可能降为6秒)' } ], } },
  { id: "fal-ai/bytedance/seedream/v3/text-to-image", name: "Seedream v3 (文生图)", type: 'image', isActive: true, defaults: { aspectRatio: '1:1', guidanceScale: 2.5, num_images: 1, aspectRatioOptions: [ { value: '1:1', label: '1:1 (方屏)' }, { value: '3:4', label: '3:4' }, { value: '4:3', label: '4:3' }, { value: '16:9', label: '16:9 (宽屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '2:3', label: '2:3' }, { value: '3:2', label: '3:2' }, { value: '21:9', label: '21:9 (电影宽屏)' }, ], } },
  { id: "fal-ai/veo3", name: "Google Veo3 (文生视频)", type: 'video', isActive: true, defaults: { duration: '8s', aspectRatio: '16:9', durationOptions: [{ value: '8s', label: '8秒 (8s)' }], aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, ], } },
  { id: "fal-ai/kling-video/v2.1/master/image-to-video", name: "Kling v2.1 (图生视频)", type: 'video', supportsMultiImage: true, isActive: true, defaults: { duration: '5', aspectRatio: '16:9', negativePrompt: 'blur, distort, and low quality', cfgScale: '0.5', durationOptions: [ { value: '5', label: '5秒' }, { value: '10', label: '10秒' }, ], aspectRatioOptions: [ { value: '16:9', label: '16:9 (横屏)' }, { value: '9:16', label: '9:16 (竖屏)' }, { value: '1:1', label: '1:1 (方屏)' }, ], } },
  { id: "fal-ai/flux-1/schnell", name: "Flux-1 (文生图 - 备用)", type: 'image', isActive: false, defaults: { image_size: 'landscape_4_3', num_inference_steps: 4, num_images: 1, enable_safety_checker: true, imageSizeOptions: [ { value: 'square_hd', label: '高清正方形 (1024x1024)'}, { value: 'square', label: '普通正方形 (512x512)'}, { value: 'portrait_4_3', label: '竖屏 4:3'}, { value: 'portrait_16_9', label: '竖屏 16:9'}, { value: 'landscape_4_3', label: '横屏 4:3'}, { value: 'landscape_16_9', label: '横屏 16:9'}, ] } },
];
// =======================================================================

const activeModels = MODELS_CONFIG.filter(model => model.isActive);
const initialModel = activeModels.length > 0 ? activeModels[0] : null;

export function VideoGenerator() {
    // 状态定义
    const [selectedModelId, setSelectedModelId] = useState(initialModel?.id || '');
    const selectedModelConfig = MODELS_CONFIG.find(m => m.id === selectedModelId);
    const [prompt, setPrompt] = useState('');
    const [mediaResults, setMediaResults] = useState([]); 
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);
    const [duration, setDuration] = useState(initialModel?.defaults?.duration || '');
    const [aspectRatio, setAspectRatio] = useState(initialModel?.defaults?.aspectRatio || '');
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
    const [negativePrompt, setNegativePrompt] = useState(initialModel?.defaults?.negativePrompt || '');
    const [cfgScale, setCfgScale] = useState(initialModel?.defaults?.cfgScale || '');
    const [imageSize, setImageSize] = useState(initialModel?.defaults?.image_size || '');
    const [guidanceScale, setGuidanceScale] = useState(initialModel?.defaults?.guidanceScale || 2.5);
    const [numImages, setNumImages] = useState(initialModel?.defaults?.num_images || 1);
    const [promptOptimizer, setPromptOptimizer] = useState(initialModel?.defaults?.prompt_optimizer ?? true);
    const [motionBucketId, setMotionBucketId] = useState(initialModel?.defaults?.motion_bucket_id || 127);
    const [condAug, setCondAug] = useState(initialModel?.defaults?.cond_aug || 0.02);
    const [isMultiImageMode, setIsMultiImageMode] = useState(false);

    useEffect(() => { return () => { imagePreviewUrls.forEach(url => URL.revokeObjectURL(url)); }; }, [imagePreviewUrls]);
    
    const resetAllFields = (newModelConfig) => {
        setPrompt(''); setMediaResults([]); setError(null); setLogs([]); setImageFiles([]); setImagePreviewUrls([]);
        setIsMultiImageMode(false);
        setDuration(newModelConfig?.defaults?.duration || '');
        setAspectRatio(newModelConfig?.defaults?.aspectRatio || '');
        setNegativePrompt(newModelConfig?.defaults?.negativePrompt || '');
        setCfgScale(newModelConfig?.defaults?.cfgScale || '');
        setImageSize(newModelConfig?.defaults?.image_size || '');
        setGuidanceScale(newModelConfig?.defaults?.guidanceScale || 2.5);
        setNumImages(newModelConfig?.defaults?.num_images || 1);
        setPromptOptimizer(newModelConfig?.defaults?.prompt_optimizer ?? true);
        setMotionBucketId(newModelConfig?.defaults?.motion_bucket_id || 127);
        setCondAug(newModelConfig?.defaults?.cond_aug || 0.02);
    };

    const handleModelChange = (newModelId) => {
        setSelectedModelId(newModelId);
        resetAllFields(MODELS_CONFIG.find(m => m.id === newModelId));
    };

    const handleFileChange = (e) => {
        imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
        let files = Array.from(e.target.files);
        if (!isMultiImageMode && files.length > 0) { files = [files[0]]; }
        if (isMultiImageMode && files.length > 4) { setError("最多只能选择4张图片。已自动截取前4张。"); files = files.slice(0, 4); } else { setError(null); }
        setImageFiles(files);
        setImagePreviewUrls(files.map(file => URL.createObjectURL(file)));
    };
    
    const handleMultiImageToggle = (e) => {
        setIsMultiImageMode(e.target.checked);
        setImageFiles([]);
        setImagePreviewUrls([]);
        setError(null);
    };

    // [核心修复] 恢复 handleGenerate 函数的完整逻辑
    const handleGenerate = async () => {
        if (isLoading || (isImageToVideo && imageFiles.length === 0)) {
            return;
        }
        setIsLoading(true); setError(null); setMediaResults([]); setLogs([]);
        
        let initialMessage = "任务处理中，请稍候...";
        if (selectedModelConfig?.isLongRunning) { initialMessage = "任务已提交，正在生成... 这可能需要较长时间，请保持此页面开启。"; }
        setLoadingMessage(initialMessage);

        try {
            let inputPayload = { prompt, negative_prompt: negativePrompt };
            
            if (isKling) { 
                Object.assign(inputPayload, { duration: parseInt(duration, 10), aspect_ratio: aspectRatio, cfg_scale: parseFloat(cfgScale) });
                if (isMultiImageMode) {
                    inputPayload.input_image_urls = imageFiles;
                } else {
                    inputPayload.image_url = imageFiles[0];
                }
            } else if (isSeedance) { 
                Object.assign(inputPayload, { image_url: imageFiles[0], motion_bucket_id: parseInt(motionBucketId), cond_aug: parseFloat(condAug) }); 
            } else if (isSeedream) { 
                Object.assign(inputPayload, { aspect_ratio: aspectRatio, guidance_scale: parseFloat(guidanceScale), num_images: parseInt(numImages, 10) }); 
            } else if (isFlux) { 
                Object.assign(inputPayload, { image_size: imageSize, num_inference_steps: parseInt(numInferenceSteps, 10), num_images: parseInt(numImages, 10), enable_safety_checker: enableSafetyChecker }); 
            } else if (isVeo3) { 
                Object.assign(inputPayload, { aspect_ratio: aspectRatio, duration: duration }); 
            } else if (isHailuo) { 
                Object.assign(inputPayload, { duration: duration, prompt_optimizer: promptOptimizer }); 
                if(isHailuoI2V) inputPayload.image_url = imageFiles[0]; 
            }
            
            console.log(`开始请求 fal.ai, 模型: ${selectedModelId}, 参数:`, inputPayload);
            const result = await fal.subscribe(selectedModelId, {
                input: inputPayload, pollInterval: 5000, logs: true,
                onQueueUpdate: (update) => {
                    const newLogs = update.logs?.map(l => l.message) || [];
                    if (newLogs.length > 0) { setLogs(current => [...current, ...newLogs]); }
                },
            });

            console.log('接收到的完整结果:', result);
            let finalResults = [];
            const resultType = selectedModelConfig.type;
            if (resultType === 'image') {
                const images = result?.data?.images || result?.images;
                if (images && Array.isArray(images) && images.length > 0) { finalResults = images.map(img => ({ ...img, type: 'image' })); }
            } else {
                const videoUrl = result?.data?.video?.url || result?.video?.url;
                if (videoUrl) { finalResults = [{ url: videoUrl, type: 'video' }]; }
            }
            if (finalResults.length > 0) {
                setMediaResults(finalResults);
            } else {
                throw new Error(`模型返回了非预期的${resultType}数据结构。`);
            }
        } catch (err) {
            setError('处理失败: ' + (err.message || err.toString() || '未知错误'));
        } finally {
            setIsLoading(false);
        }
    };

    const isImageToVideo = selectedModelConfig?.id.includes('image-to-video');
    const isKling = selectedModelConfig?.id.includes('kling');
    const isSeedream = selectedModelConfig?.id.includes('seedream');
    const isFlux = selectedModelConfig?.id.includes('flux');
    const isVeo3 = selectedModelConfig?.id.includes('veo3');
    const isHailuoI2V = selectedModelConfig?.id === 'fal-ai/minimax/hailuo-02/pro/image-to-video';
    const isHailuoT2V = selectedModelConfig?.id === 'fal-ai/minimax/hailuo-02/pro/text-to-video';
    const isHailuo = isHailuoI2V || isHailuoT2V;
    const isSeedance = selectedModelConfig?.id.includes('seedance');
    const isButtonDisabled = isLoading || (isImageToVideo && imageFiles.length === 0);

    return (
        <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white shadow-xl rounded-lg space-y-6">
            <h1 className="text-3xl font-bold text-center text-gray-900">AI 媒体生成器 (v3.2)</h1>
            {selectedModelConfig ? (
                <>
                    <div className="space-y-2">
                        <label htmlFor="model" className="block text-sm font-medium text-gray-700">1. 选择模型</label>
                        <select id="model" className="w-full p-2 border border-gray-300 rounded-md" value={selectedModelId} onChange={(e) => handleModelChange(e.target.value)} disabled={isLoading}>
                            {activeModels.map(model => ( <option key={model.id} value={model.id}>{model.name}</option> ))}
                        </select>
                    </div>
                    
                    {isKling && selectedModelConfig.supportsMultiImage && (
                        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
                            <input id="multiImageToggle" type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded" checked={isMultiImageMode} onChange={handleMultiImageToggle} disabled={isLoading}/>
                            <label htmlFor="multiImageToggle" className="text-sm font-medium text-gray-700">启用多图模式 (最多4张)</label>
                        </div>
                    )}
                    
                    {isImageToVideo && (
                        <div className="p-3 border border-dashed border-indigo-300 rounded-md">
                            <label htmlFor="imageUpload" className="block text-sm font-medium text-gray-700 mb-2">{selectedModelConfig.name} 图片设置</label>
                            <input id="imageUpload" type="file" accept="image/*"
                                multiple={isMultiImageMode}
                                key={selectedModelId + (isMultiImageMode ? '-multi' : '-single')}
                                onChange={handleFileChange} disabled={isLoading} className="block w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                            {imagePreviewUrls.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2 justify-center">
                                    {imagePreviewUrls.map((url, index) => (
                                        <img key={index} src={url} alt={`Preview ${index + 1}`} className="h-24 w-auto object-cover rounded-md shadow" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">2. 输入提示词 (Prompt)</label>
                        <textarea id="prompt" rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="描述你想生成的内容..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isKling && ( <> <div className="space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border border-gray-300 rounded-md" value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"><label htmlFor="cfgScale" className="block text-sm font-medium">CFG Scale</label><input type="number" id="cfgScale" step="0.1" className="w-full p-2 border border-gray-300 rounded-md" value={cfgScale} onChange={e=>setCfgScale(e.target.value)} disabled={isLoading}/></div> <div className="space-y-2"> <label htmlFor="aspectRatioKling" className="block text-sm font-medium">画面比例</label> <select id="aspectRatioKling" className="w-full p-2 border border-gray-300 rounded-md" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.aspectRatioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> <div className="space-y-2"> <label htmlFor="durationKling" className="block text-sm font-medium">时长</label> <select id="durationKling" className="w-full p-2 border border-gray-300 rounded-md" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={isLoading}> {selectedModelConfig.defaults.durationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)} </select> </div> </> )}
                        {isSeedance && ( <> <div className="space-y-2"> <label htmlFor="motionBucketId" className="flex justify-between text-sm font-medium"><span>运动幅度</span><span className="font-mono">{motionBucketId}</span></label> <input type="range" id="motionBucketId" min="1" max="255" value={motionBucketId} onChange={e=>setMotionBucketId(e.target.value)} disabled={isLoading} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/> </div> <div className="space-y-2"> <label htmlFor="condAug" className="flex justify-between text-sm font-medium"><span>条件增强</span><span className="font-mono">{condAug}</span></label> <input type="range" id="condAug" min="0.00" max="0.1" step="0.01" value={condAug} onChange={e=>setCondAug(e.target.value)} disabled={isLoading} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/> </div> <div className="sm:col-span-2 space-y-2"><label htmlFor="negativePrompt" className="block text-sm font-medium">反向提示词</label><input type="text" id="negativePrompt" className="w-full p-2 border border-gray-300 rounded-md" value={negativePrompt} onChange={e=>setNegativePrompt(e.target.value)} disabled={isLoading}/></div> </> )}
                    </div>
                    
                    <button className={`w-full py-3 px-4 rounded-md text-white font-semibold text-lg transition-colors ${ isButtonDisabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700' }`} onClick={handleGenerate} disabled={isLoading || !selectedModelId}>
                        {isLoading ? '正在处理...' : `生成${selectedModelConfig?.type === 'image' ? '图片' : '视频'}`}
                    </button>
                </>
            ) : (
                <div className="text-center text-red-500">错误：没有检测到任何激活的模型。</div>
            )}
            
            <div className="mt-6 pt-4 border-t border-gray-200 min-h-[150px]">
                {/* 结果展示区 */}
            </div>
        </div>
    );
}

export default VideoGenerator;