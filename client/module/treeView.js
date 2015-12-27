import React, { Component } from 'react'
import path from 'path'

import * as C from '../constant'
import styles from '../styles/core.scss'
import classNames from 'classnames/bind'

let cx = classNames.bind(styles)

export default class TreeView extends Component {
	render() {
		return (
			<div className={cx('treeView')}>
				{ this._renderTree('/') }
			</div>
		)
	}

	_renderTree(entry) {
		let { items, selected } = this.props
		let entries = items[entry]

		if (!entries) return (<ul></ul>)

		let list = entries.map( item => {
			let name = path.basename(item.path)
			let open = items[item.path]

			let isFolder = item.type === 'folder'

			let itemClass = cx({
				'entry': true,
				'file': !isFolder,
				'folder': isFolder,
				'closed': isFolder && !open,
				'open': isFolder && open,
				'selected': item.path === selected,
			})

			return (
				<li key={item.path} className={itemClass}>
					<div className={cx('listItem')} onClick={this._onClick.bind(this, item)}>
						<span className={cx('name')}>{name}</span>
					</div>
					{ this._renderTree.bind(this, item.path) }
				</li>
			)

		})

		return (
			<ul> 
				{ list }
			</ul>
		)
	}

	_onClick(item, e) {
		console.log('item: ', item)
		this.props.dispatch(C.SHARE_ITEM_CLICKED, item)
		// let { tree, onFolder, onFile, onClose }
		// let open = tree[item.path]

		// this.props.dispatch(C.SELECT_ITEM, item.path)

		// if (item.type !== 'folder') this.props.dispatch(C.FILE_SELECTED, item)

		// if (open) {
		// 	this.props.dispatch(C.CLOSE_ITEM, item)
		// } else {
		// 	this.props.dispatch(C.FOLDER_SELECTED, item)
		// }
	}
}