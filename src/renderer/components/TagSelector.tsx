import React, { useState, useEffect } from 'react';

interface FileTag {
  id: number;
  name: string;
  description?: string;
  color: string;
  category_id: number;
}

interface FileTagCategory {
  id: number;
  name: string;
  description?: string;
  color: string;
  is_system_category: boolean;
}

interface TagSelectorProps {
  tags: FileTag[];
  selectedTags: number[];
  onTagToggle: (tagId: number) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  tags,
  selectedTags,
  onTagToggle
}) => {
  const [categories, setCategories] = useState<FileTagCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const categoriesData = await window.electronAPI.getTagCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading tag categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group tags by category
  const groupedTags = tags.reduce((acc, tag) => {
    const categoryId = tag.category_id;
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(tag);
    return acc;
  }, {} as Record<number, FileTag[]>);

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : `Category ${categoryId}`;
  };

  const getCategoryColor = (categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#6c757d';
  };

  return (
    <div className="tag-selector">
      {isLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tag categories...</p>
        </div>
      ) : (
        Object.entries(groupedTags).map(([categoryId, categoryTags]) => (
          <div key={categoryId} className="tag-category">
            <h4 
              className="tag-category-title"
              style={{ 
                color: getCategoryColor(Number(categoryId)),
                borderLeft: `4px solid ${getCategoryColor(Number(categoryId))}`
              }}
            >
              {getCategoryName(Number(categoryId))}
            </h4>
          <div className="tag-container">
            {categoryTags.map((tag) => (
              <div
                key={tag.id}
                className={`tag ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
                onClick={() => onTagToggle(tag.id)}
                style={{
                  backgroundColor: selectedTags.includes(tag.id) ? tag.color : '#f0f0f0',
                  color: selectedTags.includes(tag.id) ? 'white' : '#262626'
                }}
                title={tag.description}
              >
                {tag.name}
                {selectedTags.includes(tag.id) && (
                  <span className="tag-remove" onClick={(e) => {
                    e.stopPropagation();
                    onTagToggle(tag.id);
                  }}>
                    ×
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        ))
      )}
      
      {!isLoading && tags.length === 0 && (
        <div className="empty-state">
          <p>No tags available. Please check your connection.</p>
        </div>
      )}
    </div>
  );
};
