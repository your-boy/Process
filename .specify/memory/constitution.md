<!--
Sync Impact Report
Version change: 1.0.0 -> 1.1.0
Modified principles:
- None renamed; numbering shifted after adding IV. Modern Interface Quality
Added sections:
- IV. Modern Interface Quality
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .github/copilot-instructions.md
Follow-up TODOs:
- None
-->

# UniApp Test Project Constitution

## Core Principles

### I. Comprehensive Code Documentation

**Principle**: Every line of code must be documented
**Description**: Maintain clear, concise comments for every line of code explaining its purpose, functionality, and any important considerations. Documentation should be written in Chinese for better team understanding and maintainability.

### IV. Modern Interface Quality

**Principle**: User-facing pages and buttons MUST be beautiful, elegant, natural, and modern
**Description**: Every user-facing operational page, toolbar, dialog, form, and primary or secondary button MUST present clear visual hierarchy, balanced spacing, coherent typography, polished interactive states, and contemporary interaction patterns. Default browser styling or visibly unfinished controls MUST NOT ship unless the surface is explicitly approved as internal-only.
**Rationale**: This product is interaction-heavy. Visual polish and natural controls directly affect trust, usability, and perceived product quality.

## Additional Constraints

### V. Code Quality Standards

**Description**:

- Follow consistent coding style and formatting
- Use meaningful variable and function names
- Implement proper error handling and logging
- Ensure all code is testable and maintainable
- Avoid code duplication through proper abstraction

### VI. Performance Considerations

**Description**:

- Optimize for performance without premature optimization
- Profile code before making performance improvements
- Consider memory usage and execution efficiency
- Implement caching strategies where appropriate
- Monitor and measure performance metrics

### VII. Security Requirements

**Description**:

- Validate all user inputs
- Implement proper authentication and authorization
- Use secure coding practices to prevent common vulnerabilities
- Regular security audits and code reviews
- Keep dependencies up to date with security patches

## Development Workflow

### VIII. Bug Fix Process

**Description**:

1. Reproduce the issue and understand the root cause
2. Create a targeted test case to verify the fix
3. Implement minimal changes to address the specific issue
4. Test thoroughly to ensure no regressions
5. Document the fix and update relevant comments
6. Submit for review with clear explanation of changes

### IX. Code Review Standards

**Description**:

- All code changes must be reviewed by at least one team member
- Reviewers focus on code quality, documentation, and adherence to principles
- Bug fixes should be particularly scrutinized for scope creep
- New framework introductions require justification and approval
- Documentation completeness is mandatory
- User-facing changes must be reviewed for visual polish, interaction clarity, and button/page consistency

### X. Testing Requirements

**Description**:

- Unit tests for all new functionality
- Integration tests for critical workflows
- Test coverage should be maintained above 80%
- All tests must pass before deployment
- Regular test suite maintenance and updates

## Governance

### XI. Constitution Enforcement

**Description**: This constitution supersedes all other development practices. All team members must adhere to these principles. Amendments to the constitution require team discussion, documentation of changes, and unanimous approval.

### XII. Decision Making Process

**Description**:

- Framework adoption decisions require cost-benefit analysis
- Bug fix scope must be clearly defined and approved
- Documentation standards are non-negotiable
- Performance improvements must be data-driven
- Security considerations take precedence over other factors
- User-facing visual quality is a release gate for operational pages and controls

### XIII. Continuous Improvement

**Description**:

- Regular review of constitution effectiveness
- Gather feedback from team members on practical application
- Update principles based on project evolution and changing requirements
- Document lessons learned and share with the team
- Maintain a balance between consistency and flexibility

## Template Guidelines

### XIV. Code Template

**Description**: When creating new files, follow this template structure:

```javascript
/**
 * 文件描述：[文件功能说明]
 * 创建日期：YYYY-MM-DD
 * 作者：[作者名]
 * 版本：v1.0
 */

// 导入说明
import { something } from 'library';

// 常量定义
const CONSTANT_NAME = 'value'; // 常量说明

// 工具函数
/**
 * 函数功能：[函数详细说明]
 * @param {type} paramName - 参数说明
 * @returns {type} 返回值说明
 */
function functionName(paramName) {
  // 函数实现
  return result;
}

// 主要逻辑
export default {
  // 导出说明
  functionName
};
```

### XV. Bug Fix Template

**Description**: When documenting bug fixes, use this format:

```markdown
## Bug Fix Report

**Bug ID**: [Bug编号]
**日期**: YYYY-MM-DD
**影响范围**: [影响的功能模块]

**问题描述**：
[详细的bug描述]

**根本原因分析**：
[导致bug的根本原因]

**解决方案**：
[具体的修复步骤，保持最小化]

**测试验证**：
[验证修复的测试步骤]

**代码变更**：
- [具体的代码修改说明]
- [避免的修改说明]

**相关文档更新**：
- [更新的文档列表]
```

**Version**: 1.1.0 | **Ratified**: 2026-04-18 | **Last Amended**: 2026-04-20
