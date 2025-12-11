import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { UploadCloud, FileText, Trash2, BotMessageSquare, BookUser, Database } from 'lucide-react';
import { Toaster, toast } from 'sonner';
// Mock data for demonstration
const mockSessions = [
  { id: 'session-1', user: 'User A', lastActivity: '5 minutes ago', status: 'Active' },
  { id: 'session-2', user: 'User B', lastActivity: '1 hour ago', status: 'Idle' },
  { id: 'session-3', user: 'User C', lastActivity: '3 days ago', status: 'Archived' },
];
const mockProducts = [
  { id: 'prod-001', name: 'Oranji AI Agent', stock: 100, price: 'Liên hệ' },
  { id: 'prod-002', name: 'Cloudflare Worker Plan', stock: 50, price: '$5/tháng' },
];
const mockDocuments = [
  { name: 'API_Documentation.pdf', size: '2.5 MB', uploaded: '2024-07-20' },
  { name: 'Product_Info.docx', size: '800 KB', uploaded: '2024-07-18' },
];
export function AdminPage(): JSX.Element {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast.success(`Đang tải lên: ${file.name}`);
      // Mock upload process
      setTimeout(() => {
        toast.success(`Tải lên thành công: ${file.name}`);
      }, 2000);
    }
  };
  return (
    <AppLayout container>
      <div className="space-y-8 md:space-y-12">
        <header>
          <h1 className="text-4xl font-bold font-display">Bảng điều khiển quản trị</h1>
          <p className="text-muted-foreground mt-2">Quản lý chatbot, tài liệu và sản phẩm của bạn.</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BotMessageSquare /> Quản lý Chatbot</CardTitle>
              <CardDescription>Chỉnh sửa lời nhắc hệ thống và xem lại các phiên trò chuyện.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="system-prompt" className="text-sm font-medium">Lời nhắc hệ thống</label>
                <Textarea
                  id="system-prompt"
                  placeholder="Bạn là m���t trợ lý AI hữu ích..."
                  className="mt-1 min-h-[120px]"
                  defaultValue="Bạn là một trợ lý AI hữu ích, thông thạo tiếng Việt. Nhiệm vụ của bạn là hỗ trợ người dùng bằng cách truy xuất thông tin từ tài liệu R2 và dữ liệu sản phẩm từ D1."
                />
              </div>
              <Button onClick={() => toast.success('Đã lưu lời nhắc hệ thống!')}>Lưu thay đổi</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookUser /> Phiên trò chuyện</CardTitle>
              <CardDescription>Xem các phiên trò chuyện đang hoạt động và đã lưu trữ.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Hoạt động cuối</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSessions.map(session => (
                    <TableRow key={session.id}>
                      <TableCell>{session.user}</TableCell>
                      <TableCell>{session.lastActivity}</TableCell>
                      <TableCell><Badge variant={session.status === 'Active' ? 'default' : 'secondary'}>{session.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText /> Quản lý tài liệu (R2)</CardTitle>
              <CardDescription>Tải lên và quản lý tài liệu để AI truy xuất.</CardDescription>
            </CardHeader>
            <CardContent>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" /> Tải lên tài liệu</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Tải lên tài liệu m��i</SheetTitle>
                    <SheetDescription>
                      Tải tệp lên bộ nhớ R2 của bạn. AI sẽ có thể truy cập nội dung của các tệp này.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                      <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full text-center">
                        <UploadCloud className="w-10 h-10 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Kéo và thả hoặc nhấp để tải lên</p>
                      </label>
                      <Input id="file-upload" type="file" className="hidden" onChange={handleFileUpload} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <div className="mt-4 space-y-2">
                {mockDocuments.map(doc => (
                  <div key={doc.name} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.size}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toast.error(`Đã xóa ${doc.name}`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database /> Quản lý sản phẩm (D1)</CardTitle>
              <CardDescription>Xem và chỉnh sửa thông tin sản phẩm từ cơ sở dữ liệu D1.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Tồn kho</TableHead>
                    <TableHead>Giá</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>{product.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button className="mt-4" onClick={() => toast.info('Chức năng chỉnh sửa sản phẩm sắp ra mắt!')}>Chỉnh sửa sản phẩm</Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster richColors />
    </AppLayout>
  );
}