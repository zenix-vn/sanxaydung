'use client';

/** <select> tự gửi form chứa nó khi đổi giá trị (dùng cho ô sắp xếp, bộ lọc nhanh). */
export default function AutoSubmitSelect({
  name, value, options, className = 'sort-sel', label,
}: { name: string; value: string; options: { value: string; label: string }[]; className?: string; label?: string }) {
  return (
    <select
      key={value}
      className={className}
      name={name}
      defaultValue={value}
      aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
