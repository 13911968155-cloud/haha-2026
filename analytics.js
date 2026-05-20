// 智能分析系统 - 每5次答题自动分析用户表现

class LearningAnalytics {
    constructor() {
        this.storageKey = 'mathGameAnalytics';
        this.loadData();
    }

    // 加载分析数据
    loadData() {
        const saved = localStorage.getItem(this.storageKey);
        this.data = saved ? JSON.parse(saved) : {
            sessions: [],           // 每次游戏记录
            dailyStats: {},         // 每日统计
            levelHistory: [],       // 等级变化历史
            username: '',           // 用户名
            lastAnalysis: null,     // 上次分析时间
            currentLevel: 1,        // 当前等级
            recommendedLevel: 1,    // 推荐等级
            streakDays: 0,          // 连续学习天数
            totalProblems: 0,       // 总答题数
            totalCorrect: 0,        // 总正确数
            averageAccuracy: 0,     // 平均正确率
            weakAreas: [],          // 薄弱点
            strengths: []           // 强项
        };
    }

    // 保存数据
    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    // 记录一次游戏会话
    recordSession(sessionData) {
        const session = {
            date: new Date().toISOString(),
            level: sessionData.level,
            correct: sessionData.correct,
            wrong: sessionData.wrong,
            accuracy: sessionData.correct / (sessionData.correct + sessionData.wrong),
            maxStreak: sessionData.maxStreak,
            duration: sessionData.duration,  // 游戏时长（秒）
            problems: sessionData.problems   // 详细题目记录
        };

        this.data.sessions.push(session);
        this.data.totalProblems += sessionData.correct + sessionData.wrong;
        this.data.totalCorrect += sessionData.correct;
        
        // 更新每日统计
        const today = new Date().toDateString();
        if (!this.data.dailyStats[today]) {
            this.data.dailyStats[today] = {
                sessions: 0,
                problems: 0,
                correct: 0,
                accuracy: 0
            };
        }
        this.data.dailyStats[today].sessions++;
        this.data.dailyStats[today].problems += sessionData.correct + sessionData.wrong;
        this.data.dailyStats[today].correct += sessionData.correct;
        this.data.dailyStats[today].accuracy = 
            this.data.dailyStats[today].correct / this.data.dailyStats[today].problems;

        // 更新连续学习天数
        this.updateStreakDays();
        
        // 分析薄弱点和强项
        this.analyzePerformance(sessionData.problems);
        
        // 检查是否需要自动分析（每3天）
        this.checkAndAnalyze();
        
        this.saveData();
    }

    // 更新连续学习天数
    updateStreakDays() {
        const dates = Object.keys(this.data.dailyStats).sort();
        let streak = 0;
        const today = new Date();
        
        for (let i = dates.length - 1; i >= 0; i--) {
            const date = new Date(dates[i]);
            const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
            
            if (diffDays === streak) {
                streak++;
            } else {
                break;
            }
        }
        
        this.data.streakDays = streak;
    }

    // 分析表现（薄弱点和强项）
    analyzePerformance(problems) {
        const operationStats = {
            '+': { correct: 0, total: 0 },
            '-': { correct: 0, total: 0 }
        };
        
        const rangeStats = {
            'small': { correct: 0, total: 0 },    // 1-20
            'medium': { correct: 0, total: 0 },   // 21-50
            'large': { correct: 0, total: 0 }     // 51-100
        };

        problems.forEach(p => {
            const op = p.question.includes('+') ? '+' : '-';
            operationStats[op].total++;
            if (p.isCorrect) operationStats[op].correct++;

            const numbers = p.question.match(/\d+/g).map(Number);
            const maxNum = Math.max(...numbers);
            let range = 'small';
            if (maxNum > 50) range = 'large';
            else if (maxNum > 20) range = 'medium';
            
            rangeStats[range].total++;
            if (p.isCorrect) rangeStats[range].correct++;
        });

        // 识别薄弱点（正确率 < 70%）
        this.data.weakAreas = [];
        if (operationStats['+'].total > 0 && 
            operationStats['+'].correct / operationStats['+'].total < 0.7) {
            this.data.weakAreas.push('加法');
        }
        if (operationStats['-'].total > 0 && 
            operationStats['-'].correct / operationStats['-'].total < 0.7) {
            this.data.weakAreas.push('减法');
        }
        if (rangeStats['medium'].total > 0 && 
            rangeStats['medium'].correct / rangeStats['medium'].total < 0.7) {
            this.data.weakAreas.push('中等数字');
        }
        if (rangeStats['large'].total > 0 && 
            rangeStats['large'].correct / rangeStats['large'].total < 0.7) {
            this.data.weakAreas.push('大数字');
        }

        // 识别强项（正确率 > 90%）
        this.data.strengths = [];
        if (operationStats['+'].total > 0 && 
            operationStats['+'].correct / operationStats['+'].total > 0.9) {
            this.data.strengths.push('加法');
        }
        if (operationStats['-'].total > 0 && 
            operationStats['-'].correct / operationStats['-'].total > 0.9) {
            this.data.strengths.push('减法');
        }

        this.data.averageAccuracy = this.data.totalCorrect / this.data.totalProblems;
    }

    // 检查并执行自动分析
    checkAndAnalyze() {
        // 获取最近5次游戏记录
        const recentSessions = this.getRecentSessions(5);
        
        if (recentSessions.length < 5) {
            return; // 不足5次不分析
        }
        
        // 检查是否已经分析过这5次
        const lastSession = recentSessions[recentSessions.length - 1];
        if (this.data.lastAnalysis && new Date(this.data.lastAnalysis) >= new Date(lastSession.date)) {
            return; // 已经分析过了
        }
        
        this.performAnalysis();
    }

    // 获取最近N次的会话
    getRecentSessions(count) {
        return this.data.sessions.slice(-count);
    }

    // 执行分析
    performAnalysis() {
        const recentSessions = this.getRecentSessions(5);
        
        if (recentSessions.length < 5) return;

        // 计算最近5次的平均正确率
        const totalProblems = recentSessions.reduce((sum, s) => sum + s.correct + s.wrong, 0);
        const totalCorrect = recentSessions.reduce((sum, s) => sum + s.correct, 0);
        const recentAccuracy = totalCorrect / totalProblems;

        // 计算平均答题速度（秒/题）
        const avgSpeed = recentSessions.reduce((sum, s) => sum + s.duration, 0) / totalProblems;

        // 决定是否升级/降级/保持
        let recommendation = 'keep';
        let reason = '';

        if (recentAccuracy >= 0.85 && this.data.currentLevel < 8) {
            recommendation = 'upgrade';
            reason = `最近5次正确率达到 ${(recentAccuracy * 100).toFixed(1)}%，表现优秀，建议提升难度！`;
        } else if (recentAccuracy < 0.5 && this.data.currentLevel > 1) {
            recommendation = 'downgrade';
            reason = `最近5次正确率为 ${(recentAccuracy * 100).toFixed(1)}%，建议降低难度巩固基础。`;
        } else {
            reason = `最近5次正确率为 ${(recentAccuracy * 100).toFixed(1)}%，继续保持当前难度练习。`;
        }

        // 更新推荐等级
        if (recommendation === 'upgrade') {
            this.data.recommendedLevel = this.data.currentLevel + 1;
        } else if (recommendation === 'downgrade') {
            this.data.recommendedLevel = this.data.currentLevel - 1;
        } else {
            this.data.recommendedLevel = this.data.currentLevel;
        }

        // 记录分析结果
        const analysis = {
            date: new Date().toISOString(),
            period: '5次',
            totalProblems,
            accuracy: recentAccuracy,
            avgSpeed,
            recommendation,
            reason,
            weakAreas: [...this.data.weakAreas],
            strengths: [...this.data.strengths],
            streakDays: this.data.streakDays
        };

        this.data.lastAnalysis = new Date().toISOString();
        
        // 保存分析历史
        if (!this.data.analysisHistory) this.data.analysisHistory = [];
        this.data.analysisHistory.push(analysis);

        this.saveData();

        // 显示分析报告
        this.showAnalysisReport(analysis);

        return analysis;
    }

    // 设置用户名
    setUsername(name) {
        this.data.username = name;
        this.saveData();
    }

    // 获取用户名
    getUsername() {
        return this.data.username;
    }

    // 获取学习记录（按次数）
    getSessionRecords() {
        return this.data.sessions.map((session, index) => {
            const totalSeconds = Math.floor(session.duration);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return {
                sessionNumber: index + 1,
                date: new Date(session.date).toLocaleString('zh-CN'),
                level: session.level,
                correct: session.correct,
                wrong: session.wrong,
                accuracy: (session.accuracy * 100).toFixed(1) + '%',
                maxStreak: session.maxStreak,
                duration: minutes + '分' + seconds.toString().padStart(2, '0') + '秒'
            };
        });
    }

    // 获取推荐等级
    getRecommendedLevel() {
        return this.data.recommendedLevel;
    }

    // 显示分析报告
    showAnalysisReport(analysis) {
        const modal = document.createElement('div');
        modal.className = 'analysis-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        const levelNames = {
            1: '初出茅庐', 2: '江湖新秀', 3: '小有名气', 4: '武林高手',
            5: '一代宗师', 6: '绝世奇才', 7: '独孤求败', 8: '数学至尊'
        };

        let weakAreasHtml = '';
        if (analysis.weakAreas.length > 0) {
            weakAreasHtml = `
                <div style="margin: 15px 0; padding: 15px; background: #fff5f5; border-radius: 12px; border-left: 4px solid #ff6b6b;">
                    <div style="font-weight: 700; color: #ff6b6b; margin-bottom: 8px;">📚 需要加强</div>
                    <div style="color: #666;">${analysis.weakAreas.join('、')}</div>
                </div>
            `;
        }

        let strengthsHtml = '';
        if (analysis.strengths.length > 0) {
            strengthsHtml = `
                <div style="margin: 15px 0; padding: 15px; background: #f0fff4; border-radius: 12px; border-left: 4px solid #4ade80;">
                    <div style="font-weight: 700; color: #4ade80; margin-bottom: 8px;">🌟 你的强项</div>
                    <div style="color: #666;">${analysis.strengths.join('、')}</div>
                </div>
            `;
        }

        let recommendationHtml = '';
        if (analysis.recommendation === 'upgrade') {
            recommendationHtml = `
                <div style="margin: 15px 0; padding: 20px; background: linear-gradient(135deg, #ffeef8, #ffe0f0); border-radius: 16px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
                    <div style="font-weight: 800; color: #ff6b9d; font-size: 1.2rem; margin-bottom: 10px;">建议升级！</div>
                    <div style="color: #666; margin-bottom: 15px;">${analysis.reason}</div>
                    <button onclick="analytics.applyRecommendation()" style="padding: 12px 30px; background: linear-gradient(135deg, #ff6b9d, #ff8fab); color: white; border: none; border-radius: 25px; font-weight: 700; cursor: pointer;">
                        升级到 ${levelNames[this.data.recommendedLevel]}
                    </button>
                </div>
            `;
        } else if (analysis.recommendation === 'downgrade') {
            recommendationHtml = `
                <div style="margin: 15px 0; padding: 20px; background: #fffbeb; border-radius: 16px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">💪</div>
                    <div style="font-weight: 800; color: #f59e0b; font-size: 1.2rem; margin-bottom: 10px;">建议巩固基础</div>
                    <div style="color: #666; margin-bottom: 15px;">${analysis.reason}</div>
                    <button onclick="analytics.applyRecommendation()" style="padding: 12px 30px; background: #f59e0b; color: white; border: none; border-radius: 25px; font-weight: 700; cursor: pointer;">
                        调整到 ${levelNames[this.data.recommendedLevel]}
                    </button>
                </div>
            `;
        } else {
            recommendationHtml = `
                <div style="margin: 15px 0; padding: 20px; background: #f0f9ff; border-radius: 16px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">👍</div>
                    <div style="font-weight: 800; color: #3b82f6; font-size: 1.2rem; margin-bottom: 10px;">保持当前进度</div>
                    <div style="color: #666;">${analysis.reason}</div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div style="background: white; border-radius: 24px; padding: 25px; max-width: 420px; width: 100%; max-height: 85vh; overflow-y: auto; animation: slideUp 0.3s ease;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 4rem; margin-bottom: 10px;">📊</div>
                    <h2 style="color: #333; margin: 0;">学习分析报告</h2>
                    <p style="color: #888; margin: 5px 0;">最近5次表现分析</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
                    <div style="text-align: center; padding: 15px; background: #fff5f8; border-radius: 12px;">
                        <div style="font-size: 1.8rem; font-weight: 800; color: #ff6b9d;">${(analysis.accuracy * 100).toFixed(0)}%</div>
                        <div style="font-size: 0.8rem; color: #888;">正确率</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fff5f8; border-radius: 12px;">
                        <div style="font-size: 1.8rem; font-weight: 800; color: #ff6b9d;">${analysis.totalProblems}</div>
                        <div style="font-size: 0.8rem; color: #888;">答题数</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fff5f8; border-radius: 12px;">
                        <div style="font-size: 1.8rem; font-weight: 800; color: #ff6b9d;">${analysis.avgSpeed.toFixed(1)}s</div>
                        <div style="font-size: 0.8rem; color: #888;">平均用时</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: #fff5f8; border-radius: 12px;">
                        <div style="font-size: 1.8rem; font-weight: 800; color: #ff6b9d;">${analysis.streakDays}</div>
                        <div style="font-size: 0.8rem; color: #888;">连续天数</div>
                    </div>
                </div>

                ${weakAreasHtml}
                ${strengthsHtml}
                ${recommendationHtml}

                <button onclick="this.closest('.analysis-modal').remove()" style="width: 100%; padding: 15px; background: #f0f0f0; color: #666; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 10px;">
                    关闭
                </button>
            </div>
        `;

        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };

        document.body.appendChild(modal);
    }

    // 应用推荐
    applyRecommendation() {
        this.data.currentLevel = this.data.recommendedLevel;
        this.saveData();
        
        // 更新游戏等级
        if (window.gameState) {
            window.gameState.level = this.data.currentLevel;
        }
        
        // 关闭弹窗
        document.querySelector('.analysis-modal').remove();
        
        // 更新显示
        if (typeof updateLevelDisplay === 'function') {
            updateLevelDisplay();
        }
        if (typeof updateStartScreenLevel === 'function') {
            updateStartScreenLevel();
        }
        
        // 显示成功消息
        setTimeout(() => {
            alert('等级已更新！继续加油！🎉');
        }, 100);
    }

    // 获取当前等级
    getCurrentLevel() {
        return this.data.currentLevel;
    }

    // 设置等级
    setLevel(level) {
        this.data.currentLevel = level;
        this.data.recommendedLevel = level;
        this.saveData();
    }

    // 获取学习统计
    getStats() {
        return {
            totalProblems: this.data.totalProblems,
            totalCorrect: this.data.totalCorrect,
            accuracy: this.data.averageAccuracy,
            streakDays: this.data.streakDays,
            currentLevel: this.data.currentLevel,
            weakAreas: this.data.weakAreas,
            strengths: this.data.strengths
        };
    }

    // 手动触发分析（用于测试）
    manualAnalyze() {
        return this.performAnalysis();
    }
}

// 创建全局实例
window.analytics = new LearningAnalytics();
