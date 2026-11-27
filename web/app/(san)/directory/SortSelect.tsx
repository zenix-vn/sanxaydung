'use client';

/** Đổi kiểu sắp xếp là gửi form ngay. */
export default function SortSelect({ value }: { value: string }) {
  return (
    <select key={value} className="sort-sel" name="sort" defaultValue={value} aria-label="Sắp xếp" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      <option value="trust">Trust Score cao nhất</option>
      <option value="rating">Đánh giá tốt nhất</option>
      <option value="projects">Nhiều dự án nhất</option>
      <option value="updated">Mới cập nhật</option>
    </select>
  );
}
