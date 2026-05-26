import { PRODUCT_SECTIONS, type ProductSection } from "./types";

interface ProductLeftNavProps {
  activeSection: ProductSection;
  onSectionChange: (section: ProductSection) => void;
}

export function ProductLeftNav({ activeSection, onSectionChange }: ProductLeftNavProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 pt-1">
      {PRODUCT_SECTIONS.map((section) => {
        const active = activeSection === section;
        return (
          <button
            key={section}
            onClick={() => onSectionChange(section)}
            className={[
              "w-full text-left py-2 text-sm transition-colors",
              active
                ? "border-l-4 border-blue-600 pl-5 font-semibold text-gray-900 bg-gray-50"
                : "border-l-4 border-transparent pl-5 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            ].join(" ")}
          >
            {section}
          </button>
        );
      })}
    </aside>
  );
}
