import { redirect } from 'next/navigation';

// 待檢視列表 = 作品牆 status=review 篩選（§3.4）
export default function ReviewPage() {
  redirect('/admin/works');
}
