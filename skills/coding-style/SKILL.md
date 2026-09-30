---
name: coding-style
description: Apply this project's React and Ant Design coding conventions when creating or revising page and component code.
---

# 项目编码规范

## 1. 组件声明

使用 `const Comp = (props: IProps) => {}` 模式，不使用 `function` 声明：

```tsx
const MyComponent = (props: IProps) => {
  return <div>...</div>;
};

export default MyComponent;
```

## 2. Props 类型

- 主 Props 命名为 `IProps`（使用 `interface`）
- 子类型使用 `I` + 语义化名称

```tsx
interface IProps {
  open: boolean;
  onClose: () => void;
  data: IItemData | null;
}

interface IItemData {
  id: string;
  name: string;
}
```

## 4. Modal / Drawer / columns 抽离

Modal、Drawer、columns 等从主页面抽离到 `component/`：

```text
src/pages/SomePage/
├── index.tsx
├── index.less
└── component/
    ├── SomeModal.tsx
    ├── SomeDrawer/
    │   ├── index.tsx
    │   └── index.less
    └── createColumns.tsx
```

新增/编辑弹窗使用 `ModalForm` + `ProForm*` 组件（不用 `useState` draft + 手写校验）：

- 弹窗开启 `grid`，字段用 `ProFormGroup rowProps={{ gutter: 16 }}` 包裹，一行两列 `colProps={{ span: 12 }}`
- 校验全部走表单 `rules`，不在页面渲染错误文案（如 `<p className="form-error">`）
- 弹窗状态用 `useState<Record | null | undefined>`：`undefined` 关闭 / `null` 新建 / 对象编辑

## 6. 数据与字段

- **直接使用接口返回的字段**，不做 `toXxx` 视图模型转换（如 `toSupplier`）；时间在列 render 里用 `dayjs` 格式化
- 只做「查名字」这类查表可以（如 `value_set_id` → 值域名称），不做结构改造
- 更新接口是全量替换时，直接 `{ ...record, 要改的字段 }` 整条回传，不要手工重拼每个字段——漏一个就是数据丢失
- 组件 props 只要子集时用 `Pick<ApiRecord, 'id' | 'code'>`，不要新造一个行类型
- 服务层类型对齐后端真实契约：字段名、查询参数（`page`/`per_page`）、响应形状（`{ items, total, page }`）以姊妹项目 `../DataCenter-Back` 为准，不确定时先核对后端代码再写前端类型

## 7. UI 组件优先

- 能用 antd / pro-components 组件就不手写样式：状态用 `Tag`、操作列用 `Space` + `type="link"` 按钮、通知用 `message`（不直接展示在页面上）
- 操作栏按钮统一 `<Button type="link">`（主题色即品牌绿），不用 `danger`、不用 `<a>` 标签；仅删除确认弹窗里的终确认按钮可以用 `danger`
- Icon 一律使用 `@ant-design/icons`（如 `PlusOutlined`），不用自研 `Icon` 组件
- 自定义渲染尽量用无样式 `div`/`span`，避免新增自定义 class 和手写 less

## 9. 单文件规模

单个 `.tsx` 尽量不超过 500 行。超了先拆 `component/` 子组件、抽 columns、抽 modal/drawer，不要继续往一个文件里堆。

## 10. 错误提示

- 直接展示接口返回的错误文案，不在前端把业务错误码翻成中文
- 不改 `src/api/request.ts` 的统一拦截逻辑
