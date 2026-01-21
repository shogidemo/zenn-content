# Security Policy

## Supported Versions

mainブランチの最新バージョンのみサポートしています。

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## Reporting a Vulnerability

脆弱性を発見した場合は、以下の方法でご連絡ください。

### GitHub Private Vulnerability Reporting（推奨）

1. リポジトリの「Security」タブを開く
2. 「Report a vulnerability」をクリック
3. 脆弱性の詳細を記入して送信

### 対応について

- **初回応答**: 通常1週間以内
- **重大な脆弱性**: 可能な限り迅速に対応

## Scope

セキュリティ報告の対象範囲：

- GitHub Actionsワークフローの脆弱性
- 依存関係の脆弱性
- Secretsの漏洩リスク
- 設定ファイルの脆弱性

### 対象外

- 記事内容に関する指摘（セキュリティ脆弱性ではない場合）
- 一般的な機能改善の提案

## Security Measures

このリポジトリでは以下のセキュリティ対策を実施しています：

- **Dependabot**: 依存関係の自動更新
- **Secret scanning**: シークレットの漏洩検知
- **secretlint**: コミット前のシークレット検査（lefthook）
- **Actions SHA pinning**: サプライチェーン攻撃対策
