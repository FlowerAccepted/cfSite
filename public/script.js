// 简单的 Markdown 渲染器
function renderMarkdown(text) {
    // 简单的替换，实际可以使用库如 marked
    return text
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/\n/gim, '<br>')
        .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>'); // 简单包装列表
}

// 加载数据
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        // 渲染 Markdown
        document.getElementById('markdown-render').innerHTML = '<p>' + renderMarkdown(data.markdown) + '</p>';

        // 渲染类别
        const categoriesDiv = document.getElementById('categories');
        data.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category glass-panel';
            categoryDiv.innerHTML = `
                <h3>${category.name}</h3>
                <ul>
                    ${category.links.map(link => `<li><a class="link-btn glass-btn" href="${link.url}" target="_blank"><h4>${link.name}</h4><p>${link.description}</p></a></li>`).join('')}
                </ul>
            `;
            categoriesDiv.appendChild(categoryDiv);
        });
    });

// 主题切换
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
});