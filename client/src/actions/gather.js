import { markChosen, getNode } from '../lib/utils'

const getShares = ({ state, actions }) => {
	actions.getGatherTree('/mnt/user')

	return {
		...state,
		gather: {
			...state.gather,
			cache: null,
			items: [{ label: 'Loading ...' }],
			chosen: {},
			present: [],
			target: null,
		},
	}
}

const getGatherTree = ({ state, actions, opts: { api } }, path) => {
	actions.setBusy(true)

	api.getTree(path).then(json => {
		actions.setBusy(false)
		actions.gotGatherTree(json)
	})

	return state
}

const gotGatherTree = ({ state }, newTree) => {
	let items = [].concat(state.gather.tree.items)

	if (state.gather.tree.cache) {
		const node = state.gather.tree.cache
		node.children = newTree.nodes

		// console.log(`node-${JSON.stringify(state.tree.cache)}`)
		// console.log(`gotTree-${JSON.stringify(newTree.nodes)}`)
	} else {
		items = [].concat(newTree.nodes)
	}

	// items = Utils.getNewTreeState(lineage, items, "collapsed")

	return {
		...state,
		gather: {
			...state.gather,
			items,
		},
	}
}

const gatherTreeCollapsed = ({ state, actions }, lineage) => {
	const tree = [].concat(state.gather.tree.items)
	const node = getNode(tree, lineage)
	// console.log(`node-${JSON.stringify(node)}`)

	// console.log(`utils-${JSON.stringify(Utils)}`)
	// return state

	node.collapsed = !node.collapsed

	const notRetrieved = node.children && node.children.length === 1 && node.children[0].label === 'Loading ...'
	notRetrieved && actions.getGatherTree(node.path)

	return {
		...state,
		gather: {
			...state.gather,
			cache: node,
			items: tree,
		},
	}
}

const gatherTreeChecked = ({ state, actions }, lineage) => {
	const items = [].concat(state.gather.items)
	const chosen = Object.assign({}, state.gather.chosen)
	// const lineage2 = [].concat(lineage)

	markChosen(items, lineage, chosen)

	// trigger search for disks where this share/folder is present
	actions.gatherTreeLocate(Object.keys(chosen))
	// actions.gatherTreeLocate(lineage2)

	return {
		...state,
		gather: {
			...state.gather,
			chosen,
			items,
			present: [],
		},
	}
}

const gatherTreeLocate = ({ state, actions, opts: { api } }, chosen) => {
	// const tree = [].concat(state.gatherTree.items)
	// const node = getNode(tree, lineage)

	// node.path is in the form of /mnt/user/tvshows/Breaking Bad
	// so we remove /mnt/user
	// const path = node.path.slice(10)

	api.locate(chosen).then(json => actions.gatherTreeLocated(json))

	return state
}

const gatherTreeLocated = ({ state }, disks) => {
	// console.log(`disks-(${JSON.stringify(disks)})`)
	return {
		...state,
		gather: {
			...state.gather,
			present: disks,
		},
	}
}

const findTargets = ({ state, actions, opts: { ws } }) => {
	actions.setBusy(true)

	const folders = Object.keys(state.gather.tree.chosen).map(folder => folder.slice(10)) // remove /mnt/user/
	ws.send({ topic: 'findTargets', payload: folders })

	return {
		...state,
		gather: {
			...state.gather,
			target: null,
		},
	}
}

const findFinished = ({ state, actions }, operation) => {
	if (operation.bytesToTransfer === 0) {
		const feedback = []

		feedback.push('The calculate operation found that no folders/files can be moved/copied.')
		feedback.push('')
		feedback.push('This might be due to one of the following reasons:')
		feedback.push(
			'- The source share(s)/folder(s) you selected are either empty or do not exist in the source disk',
		)
		feedback.push(
			"- There isn't available space in any of the target disks, to move/copy the share(s)/folder(s) you selected",
		)
		feedback.push('')
		feedback.push(
			'Check more disks in the TO column or go to the Settings page, to review the share(s)/folder(s) selected for moving/copying or to change the amount of reserved space.',
		)

		actions.addFeedback(feedback)
	}

	actions.gotOperation(operation)
	actions.setBusy(false)

	return state
}

export default {
	getShares,

	getGatherTree,
	gotGatherTree,

	gatherTreeCollapsed,
	gatherTreeChecked,

	gatherTreeLocate,
	gatherTreeLocated,

	findTargets,
	findFinished,
}
