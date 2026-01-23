// 加载数据
fetch('data.json')
    .then(response => response.json())
    .then(data => {
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
