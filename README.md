# ERP Quatar Crop Science

Phần mềm quản trị cho nhà máy phân bón Quatar: kinh doanh, kho, sản xuất – QC, kế toán, danh mục, nhân sự.

- **Giao diện:** trang tĩnh (`index.html`, `app.js`, `style.css`) chạy trên GitHub Pages.
- **Dữ liệu:** Supabase (Postgres + đăng nhập + phân quyền theo vai trò, RLS trên mọi bảng).
- **Cơ sở dữ liệu:** các file migration nằm trong `db/`, chạy theo thứ tự số.

## Phiên bản 0.1 (22/11/2026)
- Đăng nhập bằng tên đăng nhập; tài khoản do CEO / Admin cấp, bắt đổi mật khẩu lần đầu.
- Menu theo bộ phận, chỉ hiện phân hệ đúng quyền của vai trò.
- Danh mục đầy đủ (khách hàng, thành phẩm, NVL, bao bì, NCC, kho & vị trí, nhà xe, máy, danh mục chung): thêm, sửa, ngừng dùng, xóa khi chưa phát sinh.
- Kho: Nhập kho, Xuất kho, Điều chuyển (lưu nháp → ghi sổ → hủy có lý do), tồn kho theo mặt hàng / lô, in phiếu.
- Người dùng & phân quyền: tạo tài khoản kèm vai trò và phạm vi, khóa / mở, đặt lại mật khẩu.

Khóa Supabase trong `app.js` là khóa công khai (anon), an toàn để đưa lên web; mọi quyền được kiểm tra phía máy chủ.
