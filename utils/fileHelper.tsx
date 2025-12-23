import { FileText, FileSpreadsheet, FilePieChart, FileArchive, FileCode, File, FileVideo, FileAudio } from 'lucide-react';

export const getFileIconProps = (fileName: string = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    switch (true) {
        case ['pdf'].includes(ext):
            return { Icon: FileText, color: 'text-red-500', bg: 'bg-red-100' };
        case ['doc', 'docx'].includes(ext):
            return { Icon: FileText, color: 'text-blue-500', bg: 'bg-blue-100' };
        case ['xls', 'xlsx', 'csv'].includes(ext):
            return { Icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-100' };
        case ['ppt', 'pptx'].includes(ext):
            return { Icon: FilePieChart, color: 'text-orange-500', bg: 'bg-orange-100' };
        case ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext):
            return { Icon: FileArchive, color: 'text-yellow-600', bg: 'bg-yellow-100' };
        case ['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'xml'].includes(ext):
            return { Icon: FileCode, color: 'text-purple-600', bg: 'bg-purple-100' };
        case ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext):
            return { Icon: FileVideo, color: 'text-violet-500', bg: 'bg-violet-100' };
        case ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext):
            return { Icon: FileAudio, color: 'text-pink-500', bg: 'bg-pink-100' };
        default:
            return { Icon: File, color: 'text-gray-500', bg: 'bg-gray-100' };
    }
};
